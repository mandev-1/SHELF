package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"budgetapi/internal/db"
	"budgetapi/internal/httpx"
)

// BudgetHandler serves the /api/budget endpoints (a singleton budget row).
type BudgetHandler struct {
	Store *db.Store
}

// Get handles GET /api/budget.
func (h *BudgetHandler) Get(w http.ResponseWriter, r *http.Request) {
	budget, err := h.Store.GetBudget(r.Context())
	if err != nil {
		log.Printf("budget.Get: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to get budget")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, budget)
}

// Update handles PATCH /api/budget. The body is the raw new `data` jsonb.
func (h *BudgetHandler) Update(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	if len(raw) == 0 {
		httpx.Error(w, http.StatusBadRequest, "request body is required")
		return
	}
	if !json.Valid(raw) {
		httpx.Error(w, http.StatusBadRequest, "request body must be valid JSON")
		return
	}

	updated, err := h.Store.UpdateBudgetData(r.Context(), json.RawMessage(raw))
	if err != nil {
		log.Printf("budget.Update: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to update budget")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}
