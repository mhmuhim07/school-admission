# School Admission System

A robust, full-stack admission system for schools operating on a strict **first-come, first-served** basis. The system guarantees that even during peak traffic spikes with thousands of parents applying simultaneously, the number of allocated seats (`held + confirmed`) will **never** exceed the class capacity.

---

## 🛠️ Tech Stack

- **Backend:** C# (.NET 10 Minimal APIs) & Entity Framework Core
- **Database:** PostgreSQL 16
- **Frontend:** React 18, TypeScript, Vite, CSS Design System
- **Containerization:** Docker & Docker Compose
- **Testing:** xUnit & ASP.NET Core `WebApplicationFactory`

---

## 🚀 Getting Started

The entire project runs inside Docker. **No local installations of .NET, Node.js, or PostgreSQL are required.**

### 1. Build and Start All Services

```bash
docker compose up --build -d
```

Once running:
- **Frontend Web UI:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8880](http://localhost:8880)

---

## 🧪 Running Automated Tests

The backend test suite includes functional tests and a high-concurrency race condition test (200 simultaneous requests competing for 20 seats):

```bash
docker compose run --rm --build tests
```

## 🌟 Key Features

### Student Portal
- **Zero-Login Identity:** Uses a 17-digit student birth registration number (`X-Student-Id` header).
- **Session Persistence:** Remembers identity in `localStorage` across page reloads and browser restarts.
- **Live Seat Counts:** Auto-updates available, held, and confirmed seats every few seconds without page reloads.
- **Seat Reservations (Holds):** Holds a seat for a configurable duration (default: 600s).
- **Live Countdown Timer:** Displays real-time countdown to expiration. If the timer hits zero, the application transitions to `EXPIRED` immediately and disables payment.
- **Payment & Confirmation:** Instant admission confirmation upon fee payment.
- **Voluntary Cancellation:** Allows parents to release their held seat back to the public pool.

### School Admin Panel
- **Portal Switcher:** Easily toggle between Student Portal and School Admin.
- **Create Class / Shift:** Form to create classes and allocate seat capacities (up to 100 seats per class).
- **Capacity Dashboard:** Real-time analytics showing total classes, capacity, confirmed admissions, active holds, and available seats with utilization progress bars.

