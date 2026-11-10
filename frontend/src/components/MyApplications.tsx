import React, { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "../api";
import type { Hold, HoldStatus } from "../types";
import { useStudent } from "../context/StudentContext";

interface MyApplicationsProps {
  refreshTrigger?: number;
  onHoldStatusChange?: () => void;
}

interface CountdownTimerProps {
  expiresAt: string;
  onExpire: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiresAt, onExpire }) => {
  const calculateRemainingSeconds = useCallback(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  }, [expiresAt]);

  const [remaining, setRemaining] = useState<number>(calculateRemainingSeconds);
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    expiredHandledRef.current = false;
    setRemaining(calculateRemainingSeconds());

    const interval = setInterval(() => {
      const sec = calculateRemainingSeconds();
      setRemaining(sec);

      if (sec <= 0 && !expiredHandledRef.current) {
        expiredHandledRef.current = true;
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemainingSeconds, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isUrgent = remaining > 0 && remaining <= 60;
  const isExpired = remaining <= 0;

  return (
    <div className={`timer-box ${isUrgent || isExpired ? "timer-urgent" : ""}`}>
      <span className="timer-label">
        {isExpired ? "⏱️ Seat reservation expired:" : "⏳ Reservation expires in:"}
      </span>
      <span className="timer-countdown">
        {isExpired ? "00:00 (EXPIRED)" : formatted}
      </span>
    </div>
  );
};

export const MyApplications: React.FC<MyApplicationsProps> = ({
  refreshTrigger,
  onHoldStatusChange,
}) => {
  const { studentId, isValid } = useStudent();
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [processingHoldId, setProcessingHoldId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchHolds = useCallback(
    async (isInitial = false) => {
      if (!isValid || !studentId) {
        setHolds([]);
        return;
      }

      try {
        if (isInitial) setLoading(true);
        const data = await api.getMyHolds(studentId);
        if (isMountedRef.current) {
          setHolds(data);
        }
      } catch (err) {
        if (isMountedRef.current && isInitial) {
          const msg =
            err instanceof ApiError ? err.message : "Failed to load your applications.";
          setErrorMessage(msg);
        }
      } finally {
        if (isMountedRef.current && isInitial) setLoading(false);
      }
    },
    [isValid, studentId]
  );

  // Re-fetch on student change or refreshTrigger
  useEffect(() => {
    isMountedRef.current = true;
    fetchHolds(true);

    // Live update every 4 seconds without page reload
    const interval = setInterval(() => {
      fetchHolds(false);
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchHolds, refreshTrigger]);

  const handleTimerExpired = (holdId: string) => {
    // Immediately flip status locally to EXPIRED without page reload
    setHolds((prev) =>
      prev.map((h) =>
        h.holdId === holdId && h.status === "HELD" ? { ...h, status: "EXPIRED" } : h
      )
    );
    if (onHoldStatusChange) onHoldStatusChange();
  };

  const handlePayFee = async (hold: Hold) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingHoldId(hold.holdId);

    try {
      await api.confirmHold(hold.holdId, studentId);
      setSuccessMessage(
        `🎉 Admission confirmed for "${hold.className || "Class"}"! Your seat is secured.`
      );
      await fetchHolds(false);
      if (onHoldStatusChange) onHoldStatusChange();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Payment failed. Please verify that your reservation has not expired.";
      setErrorMessage(msg);
      await fetchHolds(false);
      if (onHoldStatusChange) onHoldStatusChange();
    } finally {
      setProcessingHoldId(null);
    }
  };

  const handleCancel = async (hold: Hold) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel your seat hold for "${hold.className || "this class"}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingHoldId(hold.holdId);

    try {
      await api.cancelHold(hold.holdId, studentId);
      setSuccessMessage(
        `Application cancelled for "${hold.className || "Class"}". The held seat has been returned.`
      );
      await fetchHolds(false);
      if (onHoldStatusChange) onHoldStatusChange();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to cancel application.";
      setErrorMessage(msg);
      await fetchHolds(false);
      if (onHoldStatusChange) onHoldStatusChange();
    } finally {
      setProcessingHoldId(null);
    }
  };

  const renderStatusBadge = (status: HoldStatus) => {
    switch (status) {
      case "HELD":
        return <span className="badge badge-warning">⏳ Held / Pending Payment</span>;
      case "CONFIRMED":
        return <span className="badge badge-success">✅ Confirmed</span>;
      case "EXPIRED":
        return <span className="badge badge-neutral">⏱️ Expired</span>;
      case "CANCELLED":
        return <span className="badge badge-danger">🚫 Cancelled</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <section className="card">
      <div className="card-header-row">
        <div>
          <h2 className="section-title">My Applications</h2>
          <p className="section-subtitle">
            Track and complete your seat reservations for Student #{studentId || "(Not set)"}.
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

      {!isValid ? (
        <div className="state-container">
          <p className="state-title">No student identity specified</p>
          <p className="state-subtitle">
            Please enter and save your 17-digit birth registration number in the top bar to view your applications.
          </p>
        </div>
      ) : loading ? (
        <div className="state-container">
          <p className="state-subtitle">Loading your applications...</p>
        </div>
      ) : holds.length === 0 ? (
        <div className="state-container">
          <p className="state-title">No applications found</p>
          <p className="state-subtitle">
            You have not applied for any seats yet. Select a class from the list above and click &ldquo;Apply for Seat&rdquo;.
          </p>
        </div>
      ) : (
        <div>
          {holds.map((hold) => {
            const isProcessing = processingHoldId === hold.holdId;
            const isHeld = hold.status === "HELD";
            const isConfirmed = hold.status === "CONFIRMED";
            const isExpired = hold.status === "EXPIRED";

            return (
              <div
                key={hold.holdId}
                className={`hold-card status-${hold.status.toLowerCase()}`}
              >
                <div className="hold-header">
                  <div>
                    <h3 className="hold-title">{hold.className || "Class Application"}</h3>
                    <div className="hold-id">Ref ID: {hold.holdId}</div>
                  </div>
                  <div>{renderStatusBadge(hold.status)}</div>
                </div>

                {isHeld && (
                  <CountdownTimer
                    expiresAt={hold.expiresAt}
                    onExpire={() => handleTimerExpired(hold.holdId)}
                  />
                )}

                {isConfirmed && (
                  <div
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "var(--color-success-bg)",
                      color: "var(--color-success-text)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "13px",
                      fontWeight: "500",
                      marginBottom: "14px",
                    }}
                  >
                    🎉 Admission Confirmed! Your student seat is officially secured.
                  </div>
                )}

                {isExpired && (
                  <div
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "var(--color-surface-subtle)",
                      color: "var(--color-text-light)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "13px",
                      marginBottom: "14px",
                    }}
                  >
                    ⏱️ This reservation expired because the fee was not paid in time. The seat was returned to the pool.
                  </div>
                )}

                <div className="card-actions">
                  <button
                    type="button"
                    onClick={() => handlePayFee(hold)}
                    disabled={!isHeld || isProcessing}
                    className="btn btn-primary"
                    style={{
                      backgroundColor: isHeld ? "var(--color-success)" : undefined,
                    }}
                    title={
                      !isHeld
                        ? "Payment is only allowed for active reservations"
                        : "Simulate fee payment and confirm admission"
                    }
                  >
                    {isProcessing ? "Processing..." : "Pay Admission Fee"}
                  </button>

                  {isHeld && (
                    <button
                      type="button"
                      onClick={() => handleCancel(hold)}
                      disabled={isProcessing}
                      className="btn btn-secondary"
                      title="Cancel this reservation and release the seat"
                    >
                      Cancel Reservation
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

