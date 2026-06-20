"use client";

import { useState } from "react";
import type { BudgetTrip, BudgetMember } from "../lib/budget-types";
import { Avatar, uid, nowIso, today, TRIP_EMOJIS, TRIP_ACCENTS } from "../lib/budget-format";

interface TripModalProps {
  trip: BudgetTrip | null; // null = create mode
  members: BudgetMember[]; // all budget members
  onSave: (trip: BudgetTrip) => void;
  onClose: () => void;
  onRemove?: () => void; // present only in edit mode
}

export function TripModal({ trip, members, onSave, onClose, onRemove }: TripModalProps) {
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [start, setStart] = useState(trip?.startDate ?? today());
  const [end, setEnd] = useState(trip?.endDate ?? "");
  const [emoji, setEmoji] = useState(trip?.emoji ?? TRIP_EMOJIS[0]);
  const [accent, setAccent] = useState(trip?.color ?? TRIP_ACCENTS[0]);
  const [memberIds, setMemberIds] = useState<string[]>(
    trip?.memberIds?.length ? trip.memberIds : members.map((m) => m.id),
  );

  // Date sanity: end can't precede start, and a trip can't span more than ~1 year.
  // Partial/empty dates (TBD) are allowed.
  const dateError = (() => {
    if (!start || !end) return "";
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (e < s) return "End date can't be before the start date.";
    if ((e - s) / 86400000 > 366) return "A trip can't be longer than a year.";
    return "";
  })();
  const maxEnd = start
    ? new Date(new Date(start).getTime() + 366 * 86400000).toISOString().slice(0, 10)
    : undefined;

  // Name is the only hard requirement — a trip can be created before anyone is
  // added, then people get assigned later. Dates, if both set, must be sane.
  const valid = name.trim().length > 0 && !dateError;

  const toggleMember = (id: string) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (!valid) return;
    onSave({
      id: trip?.id ?? uid(),
      name: name.trim(),
      emoji,
      destination: destination.trim() || undefined,
      startDate: start || undefined,
      endDate: end || undefined,
      datesTBD: !start && !end,
      color: accent,
      cover: trip?.cover,
      memberIds,
      expenses: trip?.expenses ?? [],
      createdAt: trip?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
  };

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">TRAVEL EVENT</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gb-modal-body">
          <div style={{ gridColumn: "1 / -1" }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--fg)", margin: 0 }}>
              {trip ? "Edit trip" : "Plan a trip"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 6 }}>
              A trip is its own shared-spend pool — log costs on the road, settle up after.
            </p>
          </div>

          <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">TRIP NAME</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Croatia road trip"
            />
          </label>

          <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">DESTINATION</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Where to?"
            />
          </label>

          <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">START</span>
            <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
          </label>

          <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">END</span>
            <input
              type="date"
              value={end}
              min={start || undefined}
              max={maxEnd}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {dateError && (
            <span className="gb-basis-hint" style={{ gridColumn: "1 / -1", color: "var(--gb-neg)" }}>
              {dateError}
            </span>
          )}

          <div className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">COVER ICON</span>
            <div className="gb-emoji-row">
              {TRIP_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={"gb-emoji" + (emoji === e ? " on" : "")}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">ACCENT</span>
            <div className="gb-hues">
              {TRIP_ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"gb-hue" + (accent === c ? " on" : "")}
                  style={{ background: c }}
                  onClick={() => setAccent(c)}
                />
              ))}
            </div>
          </div>

          <div className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">WHO'S ON THE TRIP?</span>
            {members.length === 0 ? (
              <span className="gb-basis-hint">
                No people yet — create the trip now and assign who&apos;s on it later (add
                people in the Monthly tab).
              </span>
            ) : (
              <div className="gb-paidby">
                {members.map((m, i) => {
                  const on = memberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={"gb-paid-chip" + (on ? " on" : "")}
                      onClick={() => toggleMember(m.id)}
                    >
                      <Avatar member={m} idx={i} size={22} /> {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="gb-modal-foot">
          {trip && onRemove && (
            <button type="button" className="gb-modal-del" onClick={onRemove}>Remove</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="gb-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="gb-settle-btn"
            style={{ width: "auto", marginTop: 0, padding: "10px 18px" }}
            disabled={!valid}
            onClick={submit}
          >
            {trip ? "Save" : "Create trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
