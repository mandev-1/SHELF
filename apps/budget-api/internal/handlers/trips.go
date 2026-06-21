package handlers

import (
	"errors"
	"log"
	"net/http"

	"budgetapi/internal/db"
	"budgetapi/internal/httpx"
	"budgetapi/internal/models"
)

// TripsHandler serves the /api/trips endpoints.
type TripsHandler struct {
	Store *db.Store
}

// List handles GET /api/trips.
func (h *TripsHandler) List(w http.ResponseWriter, r *http.Request) {
	trips, err := h.Store.ListTrips(r.Context())
	if err != nil {
		log.Printf("trips.List: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to list trips")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, trips)
}

// Upsert handles POST /api/trips (create) and PUT /api/trips/{id} (update).
func (h *TripsHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	var t models.Trip
	if err := httpx.DecodeJSON(r, &t); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Path id (PUT) takes precedence over any id in the body.
	if id := r.PathValue("id"); id != "" {
		t.ID = id
	}
	if t.ID == "" {
		id, err := newID()
		if err != nil {
			log.Printf("trips.Upsert: id gen: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "failed to save trip")
			return
		}
		t.ID = id
	}
	if t.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	saved, err := h.Store.UpsertTrip(r.Context(), t)
	if err != nil {
		log.Printf("trips.Upsert: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to save trip")
		return
	}

	status := http.StatusOK
	if r.Method == http.MethodPost {
		status = http.StatusCreated
	}
	httpx.WriteJSON(w, status, saved)
}

// Delete handles DELETE /api/trips/{id}.
func (h *TripsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "id is required")
		return
	}
	if err := h.Store.DeleteTrip(r.Context(), id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "trip not found")
			return
		}
		log.Printf("trips.Delete: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to delete trip")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
