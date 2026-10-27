# Internal Data Access Layer

Fleet Ledger has no external/network API — it's a fully offline, local-storage-backed app. This document covers the internal `storage.js` interface, which functions as the app's data access layer and is the intended seam for a future backend swap.

## Why This Matters

Every page-specific JS file (`drivers.js`, `payments.js`, etc.) calls only these functions to read/write data — never `window.localStorage` directly. When this project migrates to a real backend, only the function bodies below need to change (e.g. `getCollection` becomes a `fetch()` call); every caller's code stays identical.

## Functions (`js/storage.js`)

### `getCollection(collectionName)`
Returns the full array for a collection. Returns `[]` if it doesn't exist yet.

### `saveCollection(collectionName, records)`
Overwrites an entire collection with a new array.

### `addRecord(collectionName, record)`
Appends a single record to an existing (or newly created) collection.

### `findRecord(collectionName, predicate)`
Returns the first record matching a predicate function, or `undefined`.

### `collectionExists(collectionName)`
Returns `true`/`false` — used for one-time seed logic (e.g. seeding the default admin only if `users` doesn't exist yet).

## Related Shared Functions (`js/utils.js`)

- `$(selector, scope)` — `querySelector` shorthand
- `generateId()` — UUID v4 (native `crypto.randomUUID` with fallback)
- `hashText(plainText)` — SHA-256 hash via Web Crypto API, used for all password storage
- `isValidEmail(email)` — basic email format validation
- `showFieldError(input, errorEl, message)` / `clearFieldError(input, errorEl)` — form validation UI helpers

## Auth Functions (`js/auth.js`)

- `login(email, password)` → `{ success, role, name, userId, linkedDriverId }`
- `createSession(sessionData, rememberMe)` — writes to localStorage or sessionStorage
- `getActiveSession()` — reads and parses the current session, or `null`
- `logout()` — clears session, redirects to login (path-aware for `driver/` subfolder)
- `redirectByRole(role)` — routes to `dashboard.html` (admin) or `driver/dashboard.html` (driver)

## Future Backend Migration Path

When moving to MySQL:
1. Replace the five `storage.js` functions with `fetch()` calls to real endpoints.
2. Replace client-side SHA-256 password hashing with server-side bcrypt/argon2.
3. Every other file in the codebase requires zero changes, by design.