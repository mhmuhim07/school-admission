import React, { useState, useEffect } from "react";
import { useStudent } from "../context/StudentContext";

interface StudentIdentityBarProps {
  activeTab: "student" | "admin";
  onTabChange: (tab: "student" | "admin") => void;
}

export const StudentIdentityBar: React.FC<StudentIdentityBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { studentId, isValid, saveStudentId, clearStudentId } = useStudent();
  const [inputVal, setInputVal] = useState(studentId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setInputVal(studentId);
  }, [studentId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const inputClass = `input input-mono ${
    errorMsg ? "input-error" : isValid ? "input-success" : ""
  }`;

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Top Navbar with Title & View Mode Toggle */}
        <div className="nav-bar">
          <div>
            <h1 className="header-title">🎓 School Admission System</h1>
            <p className="header-subtitle">
              First-come, first-served online admissions for the academic year.
            </p>
          </div>

          {/* Toggle Switch between Student and Admin */}
          <div className="toggle-group" role="tablist" aria-label="Portal Mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "student"}
              onClick={() => onTabChange("student")}
              className={`toggle-btn ${activeTab === "student" ? "active" : ""}`}
            >
              🎓 Student Portal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "admin"}
              onClick={() => onTabChange("admin")}
              className={`toggle-btn ${activeTab === "admin" ? "active" : ""}`}
            >
              ⚙️ School Admin
            </button>
          </div>
        </div>

        {/* Student Identity Box - Shown only in Student Portal */}
        {activeTab === "student" && (
          <div className="identity-box">
            <div className="identity-header">
              <label htmlFor="student-id-input" className="form-label" style={{ margin: 0 }}>
                Student Birth Registration Number (17 digits)
              </label>
              <span className="identity-counter">{inputVal.length}/17 digits</span>
            </div>

            <form onSubmit={handleSubmit} className="identity-form">
              <input
                id="student-id-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputVal}
                onChange={handleInputChange}
                placeholder="e.g. 20152691234567890"
                className={inputClass}
                style={{ flex: "1 1 240px" }}
              />

              <button type="submit" className="btn btn-primary">
                {isValid && inputVal === studentId ? "Saved" : "Save ID"}
              </button>

              {isValid && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn btn-secondary"
                  title="Clear current student identity"
                >
                  Clear
                </button>
              )}
            </form>

            {errorMsg && <p className="text-danger">⚠️ {errorMsg}</p>}

            {isValid && !errorMsg && (
              <p className="text-success">
                ✅ Active identity: <strong>{studentId}</strong> (Stored locally. Applications will persist across refreshes).
              </p>
            )}

            {!isValid && !errorMsg && (
              <p className="text-muted">
                ℹ️ Enter a valid 17-digit number to apply for seats and view your applications.
              </p>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
