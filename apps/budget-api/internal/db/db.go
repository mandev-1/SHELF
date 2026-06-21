package db

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"budgetapi/internal/models"
)

// defaultBudgetData is inserted the first time GetBudget is called and no
// budget row exists yet.
const defaultBudgetData = `{"currency":"CZK","splitBasis":"equal","members":[],"expenses":[],"trips":[]}`

// ErrNotFound is returned by data-access methods when a row that was expected to
// exist (matched by id) does not — e.g. updating or deleting an already-removed
// record. Handlers map it to HTTP 404 so the frontend can reconcile (tell the
// user "that was already removed" and refetch).
var ErrNotFound = errors.New("not found")

// isNotFound reports whether err means "no such row": either pgx.ErrNoRows, or a
// Postgres 22P02 (invalid_text_representation) raised when a malformed id — e.g.
// a tampered ?b= link that isn't a valid uuid — is compared against a uuid
// column. Both should surface to the client as 404, not 500.
func isNotFound(err error) bool {
	if errors.Is(err, pgx.ErrNoRows) {
		return true
	}
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}

// Store wraps a pgx connection pool and exposes typed data-access methods.
type Store struct {
	Pool *pgxpool.Pool
}

// New opens a pgx connection pool against url and verifies connectivity.
func New(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

// Close releases the underlying connection pool.
func (s *Store) Close() {
	s.Pool.Close()
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// ListUsers returns all users ordered by creation time.
func (s *Store) ListUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, name, role, share, income, color, created_at
		FROM users
		ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Role, &u.Share, &u.Income, &u.Color, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

// CreateUser inserts a new user. Role defaults to 'member' when empty.
func (s *Store) CreateUser(ctx context.Context, u models.User) (models.User, error) {
	role := u.Role
	if role == "" {
		role = "member"
	}

	var out models.User
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO users (id, name, role, share, income, color)
		VALUES ($1, $2, COALESCE(NULLIF($3, ''), 'member'), $4, $5, $6)
		RETURNING id, name, role, share, income, color, created_at`,
		u.ID, u.Name, role, u.Share, u.Income, u.Color,
	).Scan(&out.ID, &out.Name, &out.Role, &out.Share, &out.Income, &out.Color, &out.CreatedAt)
	if err != nil {
		return models.User{}, err
	}
	return out, nil
}

// UpdateUser patches the editable columns of a user and returns the new row.
func (s *Store) UpdateUser(ctx context.Context, id string, patch models.User) (models.User, error) {
	var out models.User
	err := s.Pool.QueryRow(ctx, `
		UPDATE users
		SET name = $2,
		    share = $3,
		    income = $4,
		    color = $5
		WHERE id = $1
		RETURNING id, name, role, share, income, color, created_at`,
		id, patch.Name, patch.Share, patch.Income, patch.Color,
	).Scan(&out.ID, &out.Name, &out.Role, &out.Share, &out.Income, &out.Color, &out.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.User{}, ErrNotFound
		}
		return models.User{}, err
	}
	return out, nil
}

// DeleteUser removes a user by id. Returns ErrNotFound if no such user exists.
func (s *Store) DeleteUser(ctx context.Context, id string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

// ListTrips returns all trips, newest first.
func (s *Store) ListTrips(ctx context.Context) ([]models.Trip, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, name, emoji, destination, start_date, end_date,
		       dates_tbd, color, cover, member_ids, expenses,
		       created_at, updated_at
		FROM trips
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	trips := make([]models.Trip, 0)
	for rows.Next() {
		var t models.Trip
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Emoji, &t.Destination, &t.StartDate, &t.EndDate,
			&t.DatesTBD, &t.Color, &t.Cover, &t.MemberIDs, &t.Expenses,
			&t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		trips = append(trips, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return trips, nil
}

// UpsertTrip inserts a new trip or updates an existing one (matched on id).
// member_ids and expenses are jsonb columns; nil raw JSON is normalized to an
// empty array.
func (s *Store) UpsertTrip(ctx context.Context, t models.Trip) (models.Trip, error) {
	memberIDs := []byte(t.MemberIDs)
	if memberIDs == nil {
		memberIDs = []byte("[]")
	}
	expenses := []byte(t.Expenses)
	if expenses == nil {
		expenses = []byte("[]")
	}

	var out models.Trip
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO trips (
			id, name, emoji, destination, start_date, end_date,
			dates_tbd, color, cover, member_ids, expenses, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			emoji = EXCLUDED.emoji,
			destination = EXCLUDED.destination,
			start_date = EXCLUDED.start_date,
			end_date = EXCLUDED.end_date,
			dates_tbd = EXCLUDED.dates_tbd,
			color = EXCLUDED.color,
			cover = EXCLUDED.cover,
			member_ids = EXCLUDED.member_ids,
			expenses = EXCLUDED.expenses,
			updated_at = now()
		RETURNING id, name, emoji, destination, start_date, end_date,
		          dates_tbd, color, cover, member_ids, expenses,
		          created_at, updated_at`,
		t.ID, t.Name, t.Emoji, t.Destination, t.StartDate, t.EndDate,
		t.DatesTBD, t.Color, t.Cover, memberIDs, expenses,
	).Scan(
		&out.ID, &out.Name, &out.Emoji, &out.Destination, &out.StartDate, &out.EndDate,
		&out.DatesTBD, &out.Color, &out.Cover, &out.MemberIDs, &out.Expenses,
		&out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return models.Trip{}, err
	}
	return out, nil
}

// DeleteTrip removes a trip by id. Returns ErrNotFound if no such trip exists.
func (s *Store) DeleteTrip(ctx context.Context, id string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM trips WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

// GetBudget returns the singleton budget row, creating a default one if none
// exists yet.
func (s *Store) GetBudget(ctx context.Context) (models.Budget, error) {
	var b models.Budget
	err := s.Pool.QueryRow(ctx, `
		SELECT id, name, data, created_at, updated_at
		FROM budgets
		ORDER BY created_at
		LIMIT 1`).Scan(&b.ID, &b.Name, &b.Data, &b.CreatedAt, &b.UpdatedAt)
	if err == nil {
		return b, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.Budget{}, err
	}

	// No budget yet — create the default singleton and return it.
	var created models.Budget
	err = s.Pool.QueryRow(ctx, `
		INSERT INTO budgets (name, data)
		VALUES ('Our Budget', $1)
		RETURNING id, name, data, created_at, updated_at`,
		json.RawMessage(defaultBudgetData),
	).Scan(&created.ID, &created.Name, &created.Data, &created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		return models.Budget{}, err
	}
	return created, nil
}

// UpdateBudgetData overwrites the singleton budget's data jsonb and bumps
// updated_at.
func (s *Store) UpdateBudgetData(ctx context.Context, data json.RawMessage) (models.Budget, error) {
	var out models.Budget
	err := s.Pool.QueryRow(ctx, `
		UPDATE budgets
		SET data = $1,
		    updated_at = now()
		WHERE id = (SELECT id FROM budgets ORDER BY created_at LIMIT 1)
		RETURNING id, name, data, created_at, updated_at`,
		data,
	).Scan(&out.ID, &out.Name, &out.Data, &out.CreatedAt, &out.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.Budget{}, ErrNotFound
		}
		return models.Budget{}, err
	}
	return out, nil
}

// GetBudgetByID returns a single budget row by id (used by ?b=<id> shared
// links). Returns ErrNotFound if the id doesn't exist.
func (s *Store) GetBudgetByID(ctx context.Context, id string) (models.Budget, error) {
	var b models.Budget
	err := s.Pool.QueryRow(ctx, `
		SELECT id, name, data, created_at, updated_at
		FROM budgets
		WHERE id = $1`, id,
	).Scan(&b.ID, &b.Name, &b.Data, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if isNotFound(err) {
			return models.Budget{}, ErrNotFound
		}
		return models.Budget{}, err
	}
	return b, nil
}

// UpdateBudgetDataByID overwrites a specific budget's data jsonb by id and bumps
// updated_at. Returns ErrNotFound if the id doesn't exist.
func (s *Store) UpdateBudgetDataByID(ctx context.Context, id string, data json.RawMessage) (models.Budget, error) {
	var out models.Budget
	err := s.Pool.QueryRow(ctx, `
		UPDATE budgets
		SET data = $2,
		    updated_at = now()
		WHERE id = $1
		RETURNING id, name, data, created_at, updated_at`,
		id, data,
	).Scan(&out.ID, &out.Name, &out.Data, &out.CreatedAt, &out.UpdatedAt)
	if err != nil {
		if isNotFound(err) {
			return models.Budget{}, ErrNotFound
		}
		return models.Budget{}, err
	}
	return out, nil
}
