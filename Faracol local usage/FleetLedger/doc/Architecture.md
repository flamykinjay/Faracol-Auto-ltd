# Architecture

## Folder Structure

FleetLedger/
├── index.html Shared login (admin + driver)
├── dashboard.html Admin dashboard
├── drivers.html
├── vehicles.html
├── payments.html
├── loans.html
├── maintenance.html
├── reports.html
├── settings.html
│
├── css/ Admin-side styles
│ ├── style.css Global design tokens, resets, base primitives
│ ├── forms.css Login form + modal system + search bars
│ ├── tables.css Shared data-table styles
│ ├── dashboard.css App shell, sidebar, stat cards, activity feed
│ ├── vehicles.css Vehicle card grid
│ ├── payments.css Compact stat cards, week pill, tabs (also reused by loans.html)
│ ├── maintenance.css Minimal — reuses tables/forms
│ ├── reports.css Chart grid, news feed
│ └── settings.css Backup/password sections
│
├── js/
│ ├── utils.js SHARED — $, validation, hashing, ID gen, form error helpers, horizontal scroll fix
│ ├── storage.js SHARED — sole Local Storage access layer
│ ├── auth.js SHARED — login, session, logout (path-aware), role redirect
│ ├── nav.js Admin sidebar only
│ ├── dashboard.js
│ ├── drivers.js
│ ├── vehicles.js
│ ├── payments.js
│ ├── loans.js
│ ├── maintenance.js
│ ├── reports.js
│ ├── settings.js
│ └── vendor/chart.min.js Self-hosted Chart.js, no CDN dependency
│
├── driver/ Everything driver-facing, kept separate from admin
│ ├── dashboard.html
│ ├── css/driver.css Standalone — mirrors admin styles but not shared files
│ └── js/
│ ├── driver-nav.js Driver's own (smaller) sidebar
│ └── driver-dashboard.js
│
└── assets/
└── images/company-logo.png


## Key Architectural Decisions

- **`storage.js` is the only file allowed to touch `window.localStorage` directly.** Every other module reads/writes through `getCollection`, `saveCollection`, `addRecord`, `findRecord`, `collectionExists`. This is what allows a future swap to a MySQL-backed API without changing any UI code — only 
`storage.js`'s function bodies would change.
- **`auth.js`, `storage.js`, `utils.js` are shared** across both admin and driver sides via relative paths (`../js/...` from inside `driver/`) rather than duplicated — avoids two copies drifting out of sync.
- **Derived, not stored, status fields.** Driver payment status is looked up live from the current open week's payment record, never stored redundantly on the driver — this was a real bug early on (Drivers and Payments pages showing conflicting status) and was fixed by making Payments the single source of truth.
- **One vehicle, one driver at a time.** Assigning a vehicle to a driver automatically unassigns it from whoever had it — enforced in both directions (from Drivers → vehicle picker, and Vehicles → driver picker).
- **Snapshot fields for historical integrity.** Payment records store `driverName` and `targetAmount` as snapshots at creation time — so deleting a driver or changing their weekly target later doesn't rewrite payment history.
- **No self-signup, anywhere.** Admin account is seeded on first load. Driver accounts can only be created or reset by the admin from `drivers.html`. This is a closed system by design.
- **Role-based routing.** `redirectByRole()` in `auth.js` sends `admin` → `dashboard.html`, `driver` → `driver/dashboard.html`. Both dashboards independently verify the session's role on load and redirect away if mismatched.
- **One file = one module = one purpose.** Each page's JS file owns only its own feature area. Shared logic lives only in `utils.js`, `storage.js`, `auth.js`, `nav.js`.
- **No artificial limits** on record counts anywhere in the codebase — Local Storage has no meaningful cap for this scale of data.

## Cross-Module Linkages

- **Maintenance ↔ Expenses:** logging a maintenance record with a cost auto-creates a linked expense entry (category: "Maintenance"). Editing or deleting the maintenance record keeps the linked expense in sync or removes it — no orphaned records in either direction.
- **Driver Logs ↔ Driver Dashboard:** a driver's submitted report and the admin's reply live on the same `driverLogs` record — this is the only two-way write channel between the admin and driver sides.
- **Weeks → Payments carry-over:** starting a new week checks the previous week's unpaid balance per driver and adds it on top of their normal target for the new week — compounding shortfalls forward automatically.