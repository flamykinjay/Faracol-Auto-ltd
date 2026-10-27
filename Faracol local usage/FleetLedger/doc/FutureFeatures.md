# Pending / Future Features

Tracked items discussed but not yet built, or explicitly deferred.

## Not Yet Built

- **Driver self-service password change** — currently only the admin can reset a driver's password from `drivers.html`. Drivers have no way to change their own password after first login.
- **Dashboard Loans stat card** — the admin dashboard doesn't yet surface a Loans summary (e.g. total outstanding on loans) even though the Loans page exists.
- **Reports: Loans chart** — no visualization of loans issued vs. repaid over time yet, unlike Payments/Expenses which already have charts.
- **Driver dashboard: "My Loans" tab** — drivers currently can't see their own loan balance/history; only the admin can view this via `loans.html`.
- **Dedicated mobile-responsive pass** — breakpoints exist throughout, but no deliberate, systematic testing/refinement pass on small screens has been done.

## Explicitly Deferred (Architectural)

- **MySQL backend migration** — needed once multiple people (e.g. admin + drivers) need to access the same data from different devices simultaneously. `storage.js` was deliberately built as the seam for this swap.
- **Real hosting/domain** — currently demoed via temporary tunnels (ngrok) or drag-and-drop static hosts (e.g. Netlify Drop); no permanent domain set up yet.

## Rebranding

- **Lagride** — planned future rename from "Fleet Ledger." Requires updating: `<title>` tags across all pages, the brand name text in `index.html`, `js/nav.js`, and `driver/js/driver-nav.js`, and the logo asset.

## Ideas Raised But Not Committed

These were floated in conversation but no firm decision was made to build them:
- Bulk admin actions (e.g. mass-update driver work status, bulk-delete old closed weeks)
- A single consolidated "driver profile" view aggregating payments, loans, maintenance, and logs in one place per driver
- Notification badges on the driver dashboard for unread admin replies or new company news