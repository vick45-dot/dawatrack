# DawaTrack v2 — Chemist Stock & Profit Management

Node.js + Express + EJS + MySQL system for a chemist: incoming stock (purchases), outgoing stock (sales), live stock levels, low-stock and expiry alerts, profit/loss analysis by day/week/month/year — now with **user accounts and owner/seller roles**.

## Roles

| | Owner | Seller |
|---|---|---|
| Record sales | ✅ (any price) | ✅ (preset price only, applied automatically) |
| See profit, costs, buying prices | ✅ | ❌ |
| Dashboard, Analytics, Stock In, Products | ✅ | ❌ |
| Manage seller accounts | ✅ | ❌ |
| See who sold what | ✅ per-seller panel | own sales today only |

Every sale is tagged with who recorded it. The owner's dashboard shows a
"Sales by seller today" breakdown, and the sales ledger has a "Sold by" column.

**Default login (created by schema.sql / upgrade.sql):**
username `admin` · password `admin123` — **change it immediately** (Sellers page → Change my password).

## How the numbers work

- **Stock on hand** is never typed in; it is always `total purchased − total sold`.
- **Profit per sale** = `(selling price − cost price) × quantity`; cost is locked at sale time using the weighted average buying cost, so history never shifts when supplier prices change.
- **Overselling is impossible**: sales run in a transaction with a product row lock.
- **Preset selling prices**: the owner sets each product's counter price; sellers cannot change it — whatever they submit, the preset is used.

## Setup (Windows, fresh install)

1. Install Node.js (v18+) and start MySQL (XAMPP works fine).
2. phpMyAdmin → SQL tab → paste `sql/schema.sql` → Go. (Or `mysql -u root -p < sql/schema.sql`.)
3. Optional sample data: select the `dawatrack` database → Import → `sql/seed.sql` → Go, then Import → `sql/upgrade.sql` (adds preset prices to the samples).
4. Copy `.env.example` to `.env`; set your MySQL user/password and a random `SESSION_SECRET`.
5. `npm install` then `npm start` → http://localhost:3000 → sign in as admin/admin123.

## Upgrading from v1 (already have the dawatrack database)

1. phpMyAdmin → select `dawatrack` → Import → `sql/upgrade.sql` → Go.
2. Replace the old project files with these, keep your `.env`, add a `SESSION_SECRET=...` line to it.
3. `npm install` (two new packages), `npm start`, sign in as admin/admin123, change the password.

Old sales made before the upgrade show as "Before user tracking" in per-seller views.

## Daily workflow

| Who | Where | What |
|---|---|---|
| Seller | Sales | pick product + quantity — price is applied automatically |
| Owner | Stock In | record deliveries: supplier, batch, expiry, qty, buying price |
| Owner | Products | add products and set their counter selling price |
| Owner | Dashboard | today's profit, per-seller sales, low-stock & expiry alerts |
| Owner | Analytics | profit/loss daily / weekly / monthly / yearly with charts |
| Owner | Sellers | create seller accounts, deactivate leavers, change password |

## Project structure

```
dawatrack/
├── server.js              # Express entry, sessions, role guards
├── db.js                  # MySQL pool
├── middleware/auth.js     # requireLogin / requireOwner
├── routes/
│   ├── auth.js            # login / logout (bcrypt)
│   ├── users.js           # seller management (owner only)
│   ├── dashboard.js       # dashboard + analytics
│   ├── products.js        # product master + preset prices
│   ├── purchases.js       # stock in
│   └── sales.js           # stock out (role-aware, transactional)
├── views/                 # EJS templates (login, users, ...)
├── public/css/
└── sql/                   # schema.sql (fresh) · upgrade.sql (v1→v2) · seed.sql
```

## Ideas for later

- Operating expenses table (rent, salaries, licences) → net profit
- Edit/void sales with an audit trail
- Receipt printing; Excel/PDF export; scheduled database backups
- Online hosting so the owner checks the shop from their phone
- M-Pesa till reconciliation
