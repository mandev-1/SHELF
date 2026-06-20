package handlers

import (
	"net/http"

	"budgetapi/internal/httpx"
)

// Health is a liveness/readiness probe used by Render's healthCheckPath.
func Health(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
