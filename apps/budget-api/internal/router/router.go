package router

import (
	"net/http"

	"budgetapi/internal/config"
	"budgetapi/internal/db"
	"budgetapi/internal/handlers"
	"budgetapi/internal/middleware"
)

// New builds the application's HTTP handler: a Go 1.22 ServeMux wired to the
// users, trips, and budget handlers, wrapped with the middleware chain.
func New(store *db.Store, cfg config.Config) http.Handler {
	mux := http.NewServeMux()

	uh := &handlers.UsersHandler{Store: store}
	th := &handlers.TripsHandler{Store: store}
	bh := &handlers.BudgetHandler{Store: store}

	mux.HandleFunc("GET /healthz", handlers.Health)

	mux.HandleFunc("GET /api/users", uh.List)
	mux.HandleFunc("POST /api/users", uh.Create)
	mux.HandleFunc("PATCH /api/users/{id}", uh.Update)
	mux.HandleFunc("DELETE /api/users/{id}", uh.Delete)

	mux.HandleFunc("GET /api/trips", th.List)
	mux.HandleFunc("POST /api/trips", th.Upsert)
	mux.HandleFunc("PUT /api/trips/{id}", th.Upsert)
	mux.HandleFunc("DELETE /api/trips/{id}", th.Delete)

	mux.HandleFunc("GET /api/budget", bh.Get)
	mux.HandleFunc("PATCH /api/budget", bh.Update)

	return middleware.Chain(
		mux,
		middleware.Recover,
		middleware.Logger,
		middleware.CORS(cfg.AllowedOrigin),
		middleware.Auth(cfg.APIToken),
	)
}
