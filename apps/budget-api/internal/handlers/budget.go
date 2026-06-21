package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"budgetapi/internal/db"
	"budgetapi/internal/httpx"
)

// BudgetHandler serves the /api/budget endpoints. There is a singleton budget
// (/api/budget) plus by-id access (/api/budget/{id}) for ?b= shared links.
type BudgetHandler struct {
	Store *db.Store
}

// Get handles GET /api/budget — the singleton budget (created if none exists).
func (h *BudgetHandler) Get(w http.ResponseWriter, r *http.Request) {
	budget, err := h.Store.GetBudget(r.Context())
	if err != nil {
		log.Printf("budget.Get: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to get budget")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, budget)
}

// GetByID handles GET /api/budget/{id} — a specific budget for a shared link.
func (h *BudgetHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "id is required")
		return
	}
	budget, err := h.Store.GetBudgetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "budget not found")
			return
		}
		log.Printf("budget.GetByID: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to get budget")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, budget)
}

// Update handles PATCH /api/budget. The body is the raw new `data` jsonb.
func (h *BudgetHandler) Update(w http.ResponseWriter, r *http.Request) {
	raw, ok := readBudgetData(w, r)
	if !ok {
		return
	}
	updated, err := h.Store.UpdateBudgetData(r.Context(), raw)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "budget not found")
			return
		}
		log.Printf("budget.Update: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to update budget")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}

// UpdateByID handles PATCH /api/budget/{id}. The body is the raw new `data` jsonb.
func (h *BudgetHandler) UpdateByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "id is required")
		return
	}
	raw, ok := readBudgetData(w, r)
	if !ok {
		return
	}
	updated, err := h.Store.UpdateBudgetDataByID(r.Context(), id, raw)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "budget not found")
			return
		}
		log.Printf("budget.UpdateByID: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to update budget")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}

// readBudgetData reads, size-limits (1MiB), and validates the raw JSON body used
// by the budget PATCH endpoints. On failure it writes an error response and
// returns ok=false; callers should just return.
func readBudgetData(w http.ResponseWriter, r *http.Request) (json.RawMessage, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, httpx.MaxBodyBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "failed to read request body")
		return nil, false
	}
	if len(raw) == 0 {
		httpx.Error(w, http.StatusBadRequest, "request body is required")
		return nil, false
	}
	if !json.Valid(raw) {
		httpx.Error(w, http.StatusBadRequest, "request body must be valid JSON")
		return nil, false
	}
	return json.RawMessage(raw), true
}
