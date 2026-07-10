# DawaTrack v3 — Chemist Stock & Profit Management

Node.js + Express + EJS + MySQL system for a chemist: incoming stock (purchases), outgoing stock (sales), live stock levels, low-stock and expiry alerts, profit/loss analysis by day/week/month/year — with **user accounts, owner/seller roles, a receipts-based POS, payment methods (cash / M-Pesa / card / PayPal / ApplePay / other), automatic M-Pesa sale recording, and cash-shift accountability**.

## What's new in v3

**Receipts POS.** Every checkout is a receipt listing the exact items bought. The payment confirms the receipt, and the receipt's items become the sale records — what the customer paid for is exactly what enters the system.

**Automatic M-Pesa (Daraja STK Push).** Seller enters the customer's phone; the customer gets the PIN prompt; Safaricom's confirmation callback hits `/mpesa/callback` and **the server records the sale by itself** — items, amounts, M-Pesa receipt number, and which seller served. Sellers never type an M-Pesa sale into existence. Demo mode (`MPESA_SIMULATE=true`) simulates the whole flow without Safaricom; real mode needs Daraja credentials in the environment and a public callback URL (Render provides one).

**Other methods.** Manual M-Pesa (confirmation code required), card, PayPal, ApplePay, other — each receipt is tagged with method + reference, and the owner's dashboard breaks revenue down by method. True auto-confirmation for cards/PayPal can be added later via a gateway (Pesapal/Flutterwave).

**Cash shifts (anti-theft).** Cash has no confirmation message, so it gets accountability instead: sellers must open a shift (with an opening float) before taking cash; every cash receipt accumulates into that shift's expected total; at close the seller declares the counted cash and the **variance is stamped permanently**. The owner's Shifts page shows every seller's variance history — shortages have names and dates. Combined with stock levels (unrecorded sales = missing stock), both theft routes are covered.

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
3. Optional sample data: select the `dawatrack` database → Import → `sql/seed.sql` → Go, then Import → `sql/preset-prices.sql` (adds preset prices to the samples).
4. Copy `.env.example` to `.env`; set your MySQL user/password and a random `SESSION_SECRET`.
5. `npm install` then `npm start` → http://localhost:3000 → sign in as admin/admin123.

## Upgrading an existing database

1. Run the migrations you're missing (each is repeat-safe): `sql/upgrade.sql` (v1→v2) then `sql/upgrade-v3.sql` (v2→v3). Via phpMyAdmin Import, or `node load-sql.js sql/upgrade-v3.sql` for cloud databases.
2. Replace the old project files with these, keep your `.env`, add `SESSION_SECRET=...` and `MPESA_SIMULATE=true` lines to it.
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
