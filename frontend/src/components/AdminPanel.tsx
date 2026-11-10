import React, { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "../api";
import type { SchoolClass } from "../types";

interface AdminPanelProps {
  onClassCreated?: () => void;
  refreshTrigger?: number;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onClassCreated,
  refreshTrigger,
}) => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form inputs
  const [className, setClassName] = useState<string>("");
  const [totalSeats, setTotalSeats] = useState<string>("50");

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const fetchClasses = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await api.getClasses();
      if (isMountedRef.current) {
        setClasses(data);
      }
    } catch (err) {
      if (isMountedRef.current && isInitial) {
        const msg = err instanceof ApiError ? err.message : "Failed to load classes.";
        setErrorMessage(msg);
      }
    } finally {
      if (isMountedRef.current && isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchClasses(true);

    // Live update every 4 seconds
    const interval = setInterval(() => {
      fetchClasses(false);
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchClasses, refreshTrigger]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = className.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter a class name (e.g. 'Class 6 - Morning Shift').");
      return;
    }
    if (trimmedName.length > 200) {
      setErrorMessage("Class name must be 200 characters or fewer.");
      return;
    }

    const seatsNum = parseInt(totalSeats, 10);
    if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 100) {
      setErrorMessage("Seat count must be a whole number between 1 and 100.");
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.createClass({
        name: trimmedName,
        totalSeats: seatsNum,
      });

      setSuccessMessage(
        `Class "${created.name}" created successfully with ${created.totalSeats} seats.`
      );
      setClassName("");
      setTotalSeats("50");

      await fetchClasses(false);
      if (onClassCreated) onClassCreated();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to create class. Please try again.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregate stats
  const totalCapacity = classes.reduce((sum, c) => sum + c.totalSeats, 0);
  const totalConfirmed = classes.reduce((sum, c) => sum + c.confirmedSeats, 0);
  const totalHeld = classes.reduce((sum, c) => sum + c.heldSeats, 0);
  const totalAvailable = classes.reduce((sum, c) => sum + c.availableSeats, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Admin Create Class Form Card */}
      <section className="card">
        <div className="card-header-row">
          <div>
            <h2 className="section-title">⚙️ Create New Class (School Admin)</h2>
            <p className="section-subtitle">
              Add a new class or shift with an allocated seat capacity.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error" role="alert">
            <div className="alert-content">
              <strong>Error: </strong> {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="alert-dismiss"
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" role="status">
            <div className="alert-content">
              <strong>Success: </strong> {successMessage}
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="alert-dismiss"
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="class-name-input" className="form-label">
                Class Name &amp; Shift
              </label>
              <input
                id="class-name-input"
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Class 6 - Morning Shift"
                maxLength={200}
                className="input"
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="total-seats-input" className="form-label">
                Seat Count (1 - 100)
              </label>
              <input
                id="total-seats-input"
                type="number"
                min="1"
                max="100"
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                placeholder="50"
                className="input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ height: "42px" }}
            >
              {submitting ? "Creating..." : "Create Class"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Admin Real-Time Overview Card */}
      <section className="card">
        <div className="card-header-row">
          <div>
            <h2 className="section-title">📊 Admission System Overview</h2>
            <p className="section-subtitle">
              Live capacity monitoring across all shifts and classes.
            </p>
          </div>
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span>Live updates active</span>
          </div>
        </div>

        {/* Global Summary Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div style={statBoxStyle}>
            <div style={statBoxLabel}>Total Classes</div>
            <div style={statBoxVal}>{classes.length}</div>
          </div>
          <div style={statBoxStyle}>
            <div style={statBoxLabel}>Total Capacity</div>
            <div style={statBoxVal}>{totalCapacity}</div>
          </div>
          <div style={statBoxStyle}>
            <div style={statBoxLabel}>Confirmed</div>
            <div style={{ ...statBoxVal, color: "var(--color-success)" }}>
              {totalConfirmed}
            </div>
          </div>
          <div style={statBoxStyle}>
            <div style={statBoxLabel}>Active Holds</div>
            <div style={{ ...statBoxVal, color: "var(--color-warning)" }}>
              {totalHeld}
            </div>
          </div>
          <div style={statBoxStyle}>
            <div style={statBoxLabel}>Available Seats</div>
            <div style={{ ...statBoxVal, color: "var(--color-primary)" }}>
              {totalAvailable}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="state-container">
            <p className="state-subtitle">Loading class overview...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="state-container">
            <p className="state-title">No classes created yet</p>
            <p className="state-subtitle">
              Use the form above to create your first class.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Class / Shift Name</th>
                  <th style={{ textAlign: "center" }}>Total Seats</th>
                  <th style={{ textAlign: "center" }}>Confirmed</th>
                  <th style={{ textAlign: "center" }}>Held (Pending)</th>
                  <th style={{ textAlign: "center" }}>Available</th>
                  <th>Capacity Utilization</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => {
                  const isFull = cls.availableSeats <= 0;
                  const confirmedPct = Math.round(
                    (cls.confirmedSeats / cls.totalSeats) * 100
                  );
                  const heldPct = Math.round(
                    (cls.heldSeats / cls.totalSeats) * 100
                  );

                  return (
                    <tr key={cls.id}>
                      <td>
                        <strong>{cls.name}</strong>
                        <div style={{ fontSize: "12px", color: "var(--color-text-light)", fontFamily: "var(--font-mono)" }}>
                          ID: {cls.id}
                        </div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "600" }}>
                        {cls.totalSeats}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--color-success)", fontWeight: "600" }}>
                        {cls.confirmedSeats}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--color-warning)", fontWeight: "600" }}>
                        {cls.heldSeats}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${
                            isFull ? "badge-danger" : "badge-success"
                          }`}
                        >
                          {isFull ? "0 (FULL)" : cls.availableSeats}
                        </span>
                      </td>
                      <td style={{ minWidth: "160px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "11px",
                            color: "var(--color-text-light)",
                            marginBottom: "4px",
                          }}
                        >
                          <span>{confirmedPct}% Confirmed</span>
                          {heldPct > 0 && <span>{heldPct}% Held</span>}
                        </div>
                        <div className="progress-track" style={{ marginBottom: 0 }}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${confirmedPct}%`,
                              backgroundColor: "var(--color-success)",
                            }}
                          />
                          <div
                            className="progress-bar"
                            style={{
                              width: `${heldPct}%`,
                              backgroundColor: "var(--color-warning)",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const statBoxStyle: React.CSSProperties = {
  backgroundColor: "var(--color-surface-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "12px 14px",
  textAlign: "center",
};

const statBoxLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text-light)",
  textTransform: "uppercase",
  marginBottom: "4px",
};

const statBoxVal: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: "var(--color-text-main)",
};

