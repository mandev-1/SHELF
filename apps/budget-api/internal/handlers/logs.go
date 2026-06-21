package handlers

import (
	"log"
	"net/http"

	"budgetapi/internal/db"
	"budgetapi/internal/httpx"
	"budgetapi/internal/models"
)

// LogsHandler serves /api/logs — the expense audit trail.
type LogsHandler struct {
	Store *db.Store
}

// List handles GET /api/logs[?tripId=<id>] (newest first).
func (h *LogsHandler) List(w http.ResponseWriter, r *http.Request) {
	tripID := r.URL.Query().Get("tripId")
	logs, err := h.Store.ListLogs(r.Context(), tripID)
	if err != nil {
		log.Printf("logs.List: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to list logs")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, logs)
}

// Create handles POST /api/logs — append one audit row.
func (h *LogsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var l models.ExpenseLog
	if err := httpx.DecodeJSON(r, &l); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if l.TripID == "" || l.ExpenseID == "" || l.Action == "" {
		httpx.Error(w, http.StatusBadRequest, "tripId, expenseId and action are required")
		return
	}
	created, err := h.Store.InsertLog(r.Context(), l)
	if err != nil {
		log.Printf("logs.Create: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to write log")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, created)
}
