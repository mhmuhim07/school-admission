import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "school_admission_student_id";

export function isValidStudentId(id: string): boolean {
  return /^\d{17}$/.test(id.trim());
}

interface StudentContextType {
  studentId: string;
  isValid: boolean;
  saveStudentId: (id: string) => boolean;
  clearStudentId: () => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [studentId, setStudentIdState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? stored.trim() : "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      if (studentId) {
        localStorage.setItem(STORAGE_KEY, studentId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to access localStorage", e);
    }
  }, [studentId]);

  const saveStudentId = (id: string): boolean => {
    const trimmed = id.trim();
    if (isValidStudentId(trimmed)) {
      setStudentIdState(trimmed);
      return true;
    }
    return false;
  };

  const clearStudentId = () => {
    setStudentIdState("");
  };

  const isValid = isValidStudentId(studentId);

  return (
    <StudentContext.Provider
      value={{
        studentId,
        isValid,
        saveStudentId,
        clearStudentId,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export function useStudent(): StudentContextType {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error("useStudent must be used within a StudentProvider");
  }
  return context;
}

