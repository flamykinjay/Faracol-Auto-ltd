# Fleet Ledger (FLMS v1)

A locally-run fleet/ride-hailing management system built with vanilla HTML5, CSS3, and JavaScript (ES6+). No frameworks, no build tools, no backend — runs entirely in the browser using Local Storage, designed to migrate cleanly to a MySQL-backed API later without touching UI code.

Planned future rebrand: **Lagride**.

## Getting Started

1. Download or clone the project folder.
2. Open `index.html` directly in a browser, or serve it with a simple local server:
then visit `http://localhost:8000`.
3. Log in with the seeded default admin account:
   - **Email:** `admin@fleetledger.com`
   - **Password:** `Admin123!`
   - Change this immediately via Settings → Change Password.

## Tech Stack

- HTML5, CSS3, JavaScript (ES6+) — no frameworks, no TypeScript, no build step
- [Chart.js v4.5.0](https://www.chartjs.org/) — self-hosted at `js/vendor/chart.min.js`, no CDN dependency, fully offline
- Local Storage for all data persistence (see `Database.md`)

## Core Features

- **Admin side:** Dashboard, Drivers (with bulk add, vehicle assignment, login management), Vehicles (card grid, driver assignment), Payments (weekly cycles, carry-over debt, expenses, misc income, finance stat cards), Loans (separate from carry-over), Maintenance (auto-linked to Expenses), Reports (charts, driver history, driver logs inbox, company news), Settings (backup/restore, change password).
- **Driver side** (`driver/` folder): own dashboard, payment history, company news (read-only), submit reports, view admin replies.
- **Security:** closed system — no self-signup anywhere. Only the admin creates or resets logins (both admin and driver). Passwords hashed client-side via Web Crypto SHA-256.
- **No record limits** anywhere — drivers, vehicles, weeks, payments, expenses, etc. can be added without bound.

## Folder Structure

See `Architecture.md` for the full breakdown.

## Known Pending Items

See `FutureFeatures.md`.