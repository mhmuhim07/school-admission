# ASSUMPTIONS & DESIGN DECISIONS

This document outlines the architectural assumptions and design decisions made for the School Admission System where the specification was open to interpretation.

---

## 1. Concurrency Guarantee Across Multiple Backend Instances

> **Requirement:** Even if two or more backend processes run simultaneously on different ports using the same database, `held + confirmed` count will never exceed `totalSeats`.

### How This Was Ensured:

1. **Pessimistic Row-Level Locking (`FOR UPDATE`):**
   * When a student requests a seat hold (`POST /classes/{classId}/holds`), the transaction executes:
     ```sql
     SELECT * FROM classes WHERE "Id" = @classId FOR UPDATE
     ```
   * Because PostgreSQL manages this lock at the database engine level, multiple independent backend instances (or parallel threads) attempting to hold a seat in the same class are strictly serialized.
   * Instance B must wait until Instance A commits or rolls back its transaction before it can read the updated hold counts and evaluate seat availability.
2. **Database-Enforced Partial Unique Index:**
   * To prevent the same student from holding multiple seats concurrently, PostgreSQL enforces a partial unique constraint:
     ```sql
     CREATE UNIQUE INDEX "ux_holds_active_student_class" 
     ON "holds" ("ClassId", "StudentId") 
     WHERE "Status" IN ('HELD', 'CONFIRMED');
     ```
   * Even under simultaneous requests from the same student across different server instances, the database guarantees that only one transaction succeeds, rejecting duplicates with error `23505`.
3. **Dual-Layer Expiration Handling:**
   * **Real-time Query Filtering:** All seat calculation queries evaluate `Status == HELD AND ExpiresAt > now()`. If a reservation's expiry timestamp passes, its seat is immediately treated as available without waiting for an external cleanup task.
   * **Background Sweeper (`HoldExpiryWorker`):** A hosted background service periodically marks stale holds as `EXPIRED` in the database to keep indexes clean.

---

## 2. Assumptions & Interpretations

### 1. Student Identity & Validation
* **Identity:** As per the specification, no authentication system or password is required. The 17-digit birth registration number acts as the unique identity.
* **Validation:** Both the UI and backend strictly enforce a 17-digit numeric string (`/^\d{17}$/`). Invalid formats return HTTP `400 Bad Request`.
* **Persistence:** The student ID is stored in the browser's `localStorage` (`school_admission_student_id`) so that refreshing the page or reopening the browser retains the student's active applications.

### 2. Classes & Shifts
* **Class Modeling:** Each shift (e.g., *"Class 6 - Morning Shift"* and *"Class 6 - Day Shift"*) is created as an independent class entity with its own dedicated seat allocation, as guided by §1.3.
* **Capacity Limit:** Total seats for any class must be a positive integer between 1 and 100 (`MaxSeats = 100`).

### 3. Payment Processing
* **Simulation:** In accordance with §1.3, no real third-party payment gateway (e.g., bKash, Stripe) is integrated. Clicking **"Pay Admission Fee"** immediately calls `POST /holds/{holdId}/confirm` to simulate successful payment and transition the hold to `CONFIRMED`.
* **Idempotency:** Calling confirm multiple times on an already confirmed hold returns `200 OK` without double-incrementing confirmed seats.

### 4. Application Status Lifecycle
* **Transitions:**
  * `HELD` $\rightarrow$ `CONFIRMED` (via fee payment before expiration)
  * `HELD` $\rightarrow$ `EXPIRED` (when countdown timer reaches 0 or server time surpasses `ExpiresAt`)
  * `HELD` $\rightarrow$ `CANCELLED` (via voluntary parent cancellation)
* **Cancellation:** Once an admission is `CONFIRMED`, it cannot be cancelled through the self-service student UI.

### 5. UI Architecture & View Switcher
* **Single Page Application:** The UI features a clean toggle between **🎓 Student Portal** and **⚙️ School Admin**. This allows both parents and school administrators to perform all required actions without needing external tools like Postman or direct database access.
* **Live Refresh:** Both the Class List and Admin Dashboard auto-poll the backend every 4 seconds to reflect live seat availability and status changes without requiring manual page reloads.

### 6. Data Retention
* **Docker Volume:** The PostgreSQL database files are mounted to a persistent Docker named volume (`pgdata`), ensuring no data is lost when running `docker compose down` followed by `docker compose up`.

