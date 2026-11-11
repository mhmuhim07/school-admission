# AI Usage & Attribution

This document details the usage of AI tools during the development of the School Admission System, in accordance with the assignment guidelines.

---

## Tools Used

- **Claude** (Anthropic)
- **Antigravity IDE**

---

## Where AI Was Used

AI was utilized primarily as an accelerator for generating boilerplate, redundant code, and scaffolding:
- **Backend Scaffolding:** Initial EF Core entity setup, standard CRUD boilerplate for endpoints, and repetitive JSON serialization mappings.
- **Frontend Scaffolding:** Initial React component layout, TypeScript interface definitions matching API contracts, and CSS design system utility classes.
- **Testing Scaffolding:** Boilerplate setup for `WebApplicationFactory` and parallel HTTP request loops for the xUnit test suite.

---

## Developer Ownership & Supervision

All core architectural decisions, data modeling, concurrency strategies, and business logic decisions were planned and supervised by the developer:
- **Architecture Planning:** Decided the end-to-end flow between Docker Compose, PostgreSQL, .NET Minimal APIs, and Vite React frontend.
- **Concurrency Strategy:** Formulated the database-level pessimistic locking (`SELECT ... FOR UPDATE`) and PostgreSQL partial unique index architecture to guarantee multi-instance safety (§1.6).
- **Assumptions & Business Rules:** Defined solutions for areas not explicitly detailed in the specification (e.g., handling shift modeling, 17-digit validation, `localStorage` persistence, view toggle for admin vs. student).
- **Testing & Verification:** Hand-tested all endpoints, race conditions, edge cases (duplicate student requests, expiry transitions), and Docker container lifecycle.

---

## AI Mistakes & How They Were Caught

### 1. In-Memory Locking vs. Multi-Instance Concurrency
* **Mistake:** The AI initially proposed application-level memory locks (such as C# `lock` statements or `SemaphoreSlim`) to prevent over-allocation.
* **How It Was Caught:** During architecture review, I noted that application-level in-memory locking breaks as soon as multiple backend containers/processes run against the same database.
* **Correction:** Replaced in-memory locks with PostgreSQL row-level locks (`SELECT * FROM classes WHERE "Id" = @id FOR UPDATE`) inside database transactions, supplemented by a partial unique index on active holds.

### 2. Client vs. Containerized Dependency Confusion
* **Mistake:** The AI suggested running local `npm install` and Node toolchains on the host machine to eliminate IDE TypeScript errors in `vite.config.ts`.
* **How It Was Caught:** I verified against the core assignment constraint: *"Nothing other than Docker should need to be installed on our machine."* Running `docker compose up --build -d` proved the application compiled and ran perfectly inside Docker without any host tools installed. Local `node_modules` was identified as purely an IDE editor-enhancement concern, preserving the strict Docker-only runtime requirement.

### 3. Expiration Countdown State Transition
* **Mistake:** The AI initially designed the hold timer to wait for a backend polling response before disabling the "Pay Admission Fee" button when time expired.
* **How It Was Caught:** Cross-referencing against §1.5 (*"When the duration expires, the application will show as EXPIRED without a page reload, and the 'Pay Admission Fee' button will be disabled"*), this created a small latency window where a user could still click pay after 00:00.
* **Correction:** Refactored the countdown timer component to immediately flip the local hold state to `EXPIRED` at `00:00` using an event callback, instantaneously disabling the button while notifying the parent list.

