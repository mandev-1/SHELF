package models

import (
	"encoding/json"
	"time"
)

// User mirrors the Supabase `users` table. JSON tags are camelCase because the
// Next.js frontend expects camelCase; the underlying columns are snake_case.
type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Share     *float64  `json:"share,omitempty"`
	Income    *float64  `json:"income,omitempty"`
	Color     *string   `json:"color,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Trip mirrors the Supabase `trips` table. MemberIDs and Expenses are jsonb
// columns surfaced as raw JSON so the frontend payload is passed through
// untouched.
type Trip struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Emoji       *string         `json:"emoji,omitempty"`
	Destination *string         `json:"destination,omitempty"`
	StartDate   *string         `json:"startDate,omitempty"`
	EndDate     *string         `json:"endDate,omitempty"`
	DatesTBD    bool            `json:"datesTBD"`
	Color       *string         `json:"color,omitempty"`
	Cover       *string         `json:"cover,omitempty"`
	MemberIDs   json.RawMessage `json:"memberIds"`
	Expenses    json.RawMessage `json:"expenses"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// Budget mirrors the Supabase `budgets` table. Data is the jsonb blob holding
// the entire budget document.
type Budget struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}
