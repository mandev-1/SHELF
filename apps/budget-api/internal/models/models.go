package models

import (
	"encoding/json"
	"time"
)

// User mirrors the Supabase `users` table. JSON tags are camelCase because the
// Next.js frontend expects camelCase; the underlying columns are snake_case.
type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Share     *float64  `json:"share,omitempty"`
	Income    *float64  `json:"income,omitempty"`
	Color     *string   `json:"color,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Trip mirrors the Supabase `trips` table. MemberIDs and Expenses are jsonb
// columns surfaced as raw JSON so the frontend payload is passed through
// untouched.
type Trip struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Emoji       *string         `json:"emoji,omitempty"`
	Destination *string         `json:"destination,omitempty"`
	StartDate   *string         `json:"startDate,omitempty"`
	EndDate     *string         `json:"endDate,omitempty"`
	DatesTBD    bool            `json:"datesTBD"`
	Color       *string         `json:"color,omitempty"`
	Cover       *string         `json:"cover,omitempty"`
	// Per-trip currencies: totals shown in MainCurrency, with SecondaryCurrency
	// in parentheses. Default 'CZK' / 'EUR' (see migration 0003).
	MainCurrency      string          `json:"mainCurrency"`
	SecondaryCurrency string          `json:"secondaryCurrency"`
	MemberIDs         json.RawMessage `json:"memberIds"`
	Expenses    json.RawMessage `json:"expenses"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// ExpenseLog mirrors the `expense_logs` audit table — one row per expense CRUD
// action. Key ids: ActorID (who), TripID, ExpenseID. Append-only.
type ExpenseLog struct {
	ID        string    `json:"id"`
	TripID    string    `json:"tripId"`
	ExpenseID string    `json:"expenseId"`
	ActorID   *string   `json:"actorId,omitempty"`
	ActorName *string   `json:"actorName,omitempty"`
	Action    string    `json:"action"` // create | update | delete
	Amount    *float64  `json:"amount,omitempty"`
	Currency  *string   `json:"currency,omitempty"`
	Note      *string   `json:"note,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Budget mirrors the Supabase `budgets` table. Data is the jsonb blob holding
// the entire budget document.
type Budget struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}
