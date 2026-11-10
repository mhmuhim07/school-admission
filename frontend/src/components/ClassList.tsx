import React, { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "../api";
import type { SchoolClass, Hold } from "../types";
import { useStudent } from "../context/StudentContext";

interface ClassListProps {
  onApplySuccess?: (newHold: Hold) => void;
}

export const ClassList: React.FC<ClassListProps> = ({ onApplySuccess }) => {
  const { studentId, isValid } = useStudent();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchClasses = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await api.getClasses();
      if (isMountedRef.current) {
        setClasses(data);
        if (errorMessage && errorMessage.includes("Cannot connect")) {
          setErrorMessage(null);
        }
      }
    } catch (err) {
      if (isMountedRef.current && isInitial) {
        const msg = err instanceof ApiError ? err.message : "Failed to load classes.";
        setErrorMessage(msg);
      }
    } finally {
      if (isMountedRef.current && isInitial) setLoading(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchClasses(true);

    const interval = setInterval(() => {
      fetchClasses(false);
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchClasses]);

  const handleApply = async (cls: SchoolClass) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValid) {
      setErrorMessage(
        "Please enter and save your valid 17-digit birth registration number above before applying for a seat."
      );
      return;
    }

    if (cls.availableSeats <= 0) {
      setErrorMessage(`Sorry, all seats in "${cls.name}" are currently taken.`);
      return;
    }

    try {
      setApplyingClassId(cls.id);
      const hold = await api.createHold(cls.id, studentId);
      setSuccessMessage(
        `Seat held successfully for "${cls.name}"! Please complete your fee payment before the reservation expires.`
      );
      await fetchClasses(false);
      if (onApplySuccess) {
        onApplySuccess(hold);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "An error occurred while reserving your seat. Please try again.";
      setErrorMessage(msg);
    } finally {
      setApplyingClassId(null);
    }
  };

  return (
    <section className="card">
      <div className="card-header-row">
        <div>
          <h2 className="section-title">Available Classes</h2>
          <p className="section-subtitle">
            Seats are allocated on a first-come, first-served basis.
          </p>
        </div>
        <div className="live-indicator">
          <span className="pulse-dot"></span>
          <span>Live updates active</span>
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

      {loading ? (
        <div className="state-container">
          <p className="state-subtitle">Loading available classes...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="state-container">
          <p className="state-title">No classes available yet</p>
          <p className="state-subtitle">
            Please wait for the school administrator to open admissions, or create a class below.
          </p>
        </div>
      ) : (
        <div className="grid-cards">
          {classes.map((cls) => {
            const isFull = cls.availableSeats <= 0;
            const isApplying = applyingClassId === cls.id;
            const confirmedPct = (cls.confirmedSeats / cls.totalSeats) * 100;
            const heldPct = (cls.heldSeats / cls.totalSeats) * 100;

            return (
              <div
                key={cls.id}
                className={`class-card ${!isFull ? "is-available" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "var(--color-text-main)" }}>
                    {cls.name}
                  </h3>
                  <span className={`badge ${isFull ? "badge-danger" : "badge-success"}`}>
                    {isFull ? "FULL" : `${cls.availableSeats} Available`}
                  </span>
                </div>

                <div className="progress-track" title={`Confirmed: ${cls.confirmedSeats}, Held: ${cls.heldSeats}`}>
                  <div
                    className="progress-bar"
                    style={{ width: `${confirmedPct}%`, backgroundColor: "var(--color-success)" }}
                  />
                  <div
                    className="progress-bar"
                    style={{ width: `${heldPct}%`, backgroundColor: "var(--color-warning)" }}
                  />
                </div>

                <div className="stat-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total</span>
                    <span className="stat-value">{cls.totalSeats}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Confirmed</span>
                    <span className="stat-value" style={{ color: "var(--color-success)" }}>
                      {cls.confirmedSeats}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Held</span>
                    <span className="stat-value" style={{ color: "var(--color-warning)" }}>
                      {cls.heldSeats}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Available</span>
                    <span
                      className="stat-value"
                      style={{
                        color: isFull ? "var(--color-danger)" : "var(--color-primary)",
                        fontWeight: "700",
                      }}
                    >
                      {cls.availableSeats}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleApply(cls)}
                  disabled={isFull || isApplying || !isValid}
                  className={`btn btn-full ${isFull || !isValid ? "btn-secondary" : "btn-primary"}`}
                  title={
                    !isValid
                      ? "Enter your 17-digit birth registration number above first"
                      : isFull
                      ? "All seats in this class are currently taken"
                      : "Hold a seat for this class"
                  }
                >
                  {isApplying
                    ? "Reserving Seat..."
                    : isFull
                    ? "Seats Full"
                    : !isValid
                    ? "Enter ID to Apply"
                    : "Apply for Seat"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
