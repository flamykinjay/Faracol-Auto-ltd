# Data Model (Local Storage)

All collections are namespaced with the prefix `flms_` (e.g. `flms_drivers`) and stored as JSON arrays via `storage.js`. No collection has an enforced size limit.

## users
Admin and driver login accounts. Seeded with one admin on first load.

{
id, name, email (login ID — real for admin, custom-styled for drivers),
passwordHash (SHA-256), role: "admin" | "driver",
linkedDriverId (driver accounts only, null for admin)
}


## drivers

{
id, name, phone, vehicleId (nullable),
weeklyTarget, joinDate, workStatus: "on-duty" | "off-duty" | "sick" | "suspended",
createdAt
}

Note: payment status is NOT stored here — derived live from `payments` for the current open week.

## vehicles

{ id, type, plateNumber, chassisNumber, createdAt }


## weeks

{
id, label, startDate, endDate,
status: "open" | "closed", createdAt
}

Only one week is ever "open" at a time. Starting a new week closes the previous one.

## payments

{
id, weekId, driverId, driverName (snapshot),
targetAmount (includes any carried-over balance), carriedOverAmount,
amountPaid, status: "paid" | "partial" | "unpaid" (auto-calculated),
notes, createdAt, updatedAt
}


## expenses

{ id, category, description, amount, date, createdAt }

Categories: Fuel, Maintenance, Salary, Loan Repayment, Other. Maintenance-linked entries are auto-generated (see `maintenanceRecords`).

## miscIncome

{ id, description, amount, date, createdAt }

One-off income (donations, gifts) — feeds into all-time Revenue.

## loans

{
id, driverId, driverName (snapshot),
principal, amountRepaid, status: "active" | "paid-off",
dateIssued, weeklyRepaymentAmount (informational only, not enforced),
notes, createdAt
}

Distinct from weekly carry-over debt. Repayment is logged manually.

## maintenanceRecords

{
id, vehicleId, vehicleLabel (snapshot),
serviceType, description, cost, date, nextServiceDue (optional),
linkedExpenseId, createdAt
}


## newsPosts

{ id, title, body, imageBase64 (optional), datePosted, createdAt }

Images stored as Base64 directly in Local Storage.

## driverLogs

{
id, driverId, driverName, category: "Vehicle Issue" | "Complaint" | "Other",
message, status: "open" | "resolved",
adminReply, replyDate, date, createdAt
}


## Business Logic Reference

- **Gross profit** = payments collected − direct vehicle costs
- **Net profit** = Revenue − Expenses, where **Revenue** = payments collected + misc income
- **Outstanding/Receivable** is tracked separately and never subtracted from profit (it's owed, not lost)
- **Carry-over** compounds forward weekly on top of a driver's normal target until paid off