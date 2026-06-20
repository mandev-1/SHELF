package config

import (
	"bufio"
	"errors"
	"os"
	"strings"
)

// Config holds the runtime configuration loaded from environment variables.
type Config struct {
	Port          string
	DatabaseURL   string
	AllowedOrigin string
	APIToken      string
}

// Load reads configuration from the environment. DATABASE_URL is required;
// every other value has a sensible default or is optional. In local dev a
// .env.local / .env file (if present) is loaded first.
func Load() (Config, error) {
	loadDotEnv()

	cfg := Config{
		Port:          getenv("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		AllowedOrigin: os.Getenv("ALLOWED_ORIGIN"),
		APIToken:      os.Getenv("API_TOKEN"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}

	return cfg, nil
}

// loadDotEnv reads .env.local (then .env) from the working directory if present
// and sets any KEY=VALUE pairs NOT already in the environment. Zero-dependency;
// real env vars (e.g. Render's) always win, and a missing file is a no-op
// (production relies on real env vars, not a committed file).
func loadDotEnv() {
	for _, name := range []string{".env.local", ".env"} {
		f, err := os.Open(name)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, val, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			val = strings.Trim(strings.TrimSpace(val), `"'`)
			if key != "" {
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
		}
		_ = f.Close()
		return // first file found wins
	}
}

// getenv returns the value of the environment variable named by key, or def
// when the variable is unset or empty.
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
