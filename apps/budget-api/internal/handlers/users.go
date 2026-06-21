package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net/http"

	"budgetapi/internal/db"
	"budgetapi/internal/httpx"
	"budgetapi/internal/models"
)

// UsersHandler serves the /api/users endpoints.
type UsersHandler struct {
	Store *db.Store
}

// List handles GET /api/users.
func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListUsers(r.Context())
	if err != nil {
		log.Printf("users.List: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, users)
}

// Create handles POST /api/users.
func (h *UsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var u models.User
	if err := httpx.DecodeJSON(r, &u); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if u.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if u.ID == "" {
		id, err := newID()
		if err != nil {
			log.Printf("users.Create: id gen: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "failed to create user")
			return
		}
		u.ID = id
	}
	created, err := h.Store.CreateUser(r.Context(), u)
	if err != nil {
		log.Printf("users.Create: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, created)
}

// Update handles PATCH /api/users/{id}.
func (h *UsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "id is required")
		return
	}
	var patch models.User
	if err := httpx.DecodeJSON(r, &patch); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	updated, err := h.Store.UpdateUser(r.Context(), id, patch)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "user not found")
			return
		}
		log.Printf("users.Update: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}

// Delete handles DELETE /api/users/{id}.
func (h *UsersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "id is required")
		return
	}
	if err := h.Store.DeleteUser(r.Context(), id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "user not found")
			return
		}
		log.Printf("users.Delete: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to delete user")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// newID returns a random 16-byte hex identifier.
func newID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
