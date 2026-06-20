package httpx

import (
	"encoding/json"
	"net/http"
)

// maxBodyBytes caps request bodies to ~1MiB to guard against abuse.
const maxBodyBytes = 1 << 20

// WriteJSON writes v as a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error writes a JSON error envelope {"error": msg} with the given status.
func Error(w http.ResponseWriter, status int, msg string) {
	WriteJSON(w, status, map[string]string{"error": msg})
}

// DecodeJSON decodes the (size-limited) request body into dst.
func DecodeJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodyBytes)
	return json.NewDecoder(r.Body).Decode(dst)
}
