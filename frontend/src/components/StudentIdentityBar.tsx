import React, { useState, useEffect } from "react";
import { useStudent, isValidStudentId } from "../context/StudentContext";

export const StudentIdentityBar: React.FC = () => {
  const { studentId, isValid, saveStudentId, clearStudentId } = useStudent();
  const [inputVal, setInputVal] = useState(studentId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync internal input when context changes
  useEffect(() => {
    setInputVal(studentId);
  }, [studentId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric digits and limit to 17
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 17);
    setInputVal(digitsOnly);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal) {
      setErrorMsg("Please enter a birth registration number.");
      return;
    }
    if (inputVal.length !== 17) {
      setErrorMsg(`Must be exactly 17 digits (currently ${inputVal.length} digits).`);
      return;
    }
    const success = saveStudentId(inputVal);
    if (!success) {
      setErrorMsg("Invalid birth registration number. Must be exactly 17 digits.");
    } else {
      setErrorMsg(null);
    }
  };

  const handleClear = () => {
    clearStudentId();
    setInputVal("");
    setErrorMsg(null);
  };

  return (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        <div>
          <h1 style={styles.title}>🎓 School Admission System</h1>
          <p style={styles.subtitle}>
            First-come, first-served online admissions for the academic year.
          </p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <label htmlFor="student-id-input" style={styles.label}>
              Student Birth Registration Number (17 digits)
            </label>
            <span style={styles.counter}>
              {inputVal.length}/17 digits
            </span>
          </div>

          <form onSubmit={handleSubmit} style={styles.formRow}>
            <input
              id="student-id-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputVal}
              onChange={handleInputChange}
              placeholder="e.g. 20152691234567890"
              style={{
                ...styles.input,
                borderColor: errorMsg
                  ? "#dc2626"
                  : isValid
                  ? "#16a34a"
                  : "#d1d5db",
              }}
            />

            <button type="submit" style={styles.primaryButton}>
              {isValid && inputVal === studentId ? "Saved" : "Save ID"}
            </button>

            {isValid && (
              <button
                type="button"
                onClick={handleClear}
                style={styles.secondaryButton}
                title="Clear current student identity"
              >
                Clear
              </button>
            )}
          </form>

          {errorMsg && <p style={styles.errorText}>⚠️ {errorMsg}</p>}

          {isValid && !errorMsg && (
            <p style={styles.successText}>
              ✅ Active identity: <strong>{studentId}</strong> (Stored locally. Applications will persist across refreshes).
            </p>
          )}

          {!isValid && !errorMsg && (
            <p style={styles.infoText}>
              ℹ️ Enter a valid 17-digit number to apply for seats and view your applications.
            </p>
          )}
        </div>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  headerContent: {
    maxWidth: "1100px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0 0",
  },
  card: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px 20px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },
  counter: {
    fontSize: "12px",
    color: "#6b7280",
    fontVariantNumeric: "tabular-nums",
  },
  formRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    flex: "1 1 240px",
    padding: "10px 14px",
    fontSize: "15px",
    fontFamily: "monospace",
    letterSpacing: "1px",
    border: "1.5px solid #d1d5db",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
  },
  primaryButton: {
    padding: "10px 18px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 14px",
    backgroundColor: "#ffffff",
    color: "#4b5563",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "13px",
    marginTop: "8px",
    marginBottom: 0,
  },
  successText: {
    color: "#16a34a",
    fontSize: "13px",
    marginTop: "8px",
    marginBottom: 0,
  },
  infoText: {
    color: "#6b7280",
    fontSize: "13px",
    marginTop: "8px",
    marginBottom: 0,
  },
};

