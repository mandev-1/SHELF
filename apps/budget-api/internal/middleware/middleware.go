package middleware

import (
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
	"time"
)

// Chain applies middlewares to h. The first middleware in the list becomes the
// OUTERMOST wrapper (i.e. it runs first on the way in and last on the way out).
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	// Wrap in reverse so the first mw ends up outermost.
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// CORS sets the relevant Access-Control-* headers and short-circuits OPTIONS
// preflight requests with a 204. If allowedOrigin is empty, "*" is used.
// CORS allows only the configured origin(s). ALLOWED_ORIGIN may be a single
// origin, a comma-separated allowlist, or "*". When unset, NO CORS header is
// emitted (cross-origin blocked) — a visible fail rather than a silent wildcard.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	allow := map[string]bool{}
	wildcard := false
	for _, o := range strings.Split(allowedOrigin, ",") {
		o = strings.TrimSpace(o)
		if o == "*" {
			wildcard = true
		} else if o != "" {
			allow[o] = true
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			h := w.Header()
			if wildcard {
				h.Set("Access-Control-Allow-Origin", "*")
			} else if origin != "" && allow[origin] {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Add("Vary", "Origin")
			}
			h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// statusRecorder wraps an http.ResponseWriter to capture the status code.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (sr *statusRecorder) WriteHeader(status int) {
	if !sr.wroteHeader {
		sr.status = status
		sr.wroteHeader = true
	}
	sr.ResponseWriter.WriteHeader(status)
}

func (sr *statusRecorder) Write(b []byte) (int, error) {
	if !sr.wroteHeader {
		// Implicit 200 OK on first write without an explicit WriteHeader.
		sr.status = http.StatusOK
		sr.wroteHeader = true
	}
	return sr.ResponseWriter.Write(b)
}

// Logger logs method, path, status and duration for each request.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sr := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sr, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sr.status, time.Since(start))
	})
}

// Recover catches panics from downstream handlers and returns a 500.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic recovered: %v", rec)
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Auth enforces a bearer token when token is non-empty. When token is empty it
// is a no-op (open, dev mode). OPTIONS preflight and the /healthz endpoint are
// always allowed through.
func Auth(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if token == "" {
				next.ServeHTTP(w, r)
				return
			}
			if r.Method == http.MethodOptions || r.URL.Path == "/healthz" {
				next.ServeHTTP(w, r)
				return
			}
			const prefix = "Bearer "
			authHeader := r.Header.Get("Authorization")
			ok := strings.HasPrefix(authHeader, prefix) &&
				subtle.ConstantTimeCompare([]byte(strings.TrimSpace(authHeader[len(prefix):])), []byte(token)) == 1
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
