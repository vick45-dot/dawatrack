const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * The core rule of the whole system:
 *   stock on hand   = SUM(purchases.quantity) - SUM(sales.quantity)
 *   profit per sale = (selling_price - cost_price) * quantity
 * Everything on this page is derived live from the two ledgers,
 * so it stays correct no matter how many entries flow in concurrently.
 */

// ---------- DASHBOARD ----------
router.get('/', async (req, res, next) => {
  try {
    // Today's trading
    const [[today]] = await db.query(`
      SELECT
        COALESCE(SUM(quantity * selling_price), 0)               AS revenue,
        COALESCE(SUM(quantity * (selling_price - cost_price)),0) AS profit,
        COUNT(*)                                                  AS transactions
      FROM sales WHERE DATE(sold_at) = CURDATE()
    `);

    // This month's trading
    const [[month]] = await db.query(`
      SELECT
        COALESCE(SUM(quantity * selling_price), 0)               AS revenue,
        COALESCE(SUM(quantity * (selling_price - cost_price)),0) AS profit
      FROM sales
      WHERE YEAR(sold_at) = YEAR(CURDATE()) AND MONTH(sold_at) = MONTH(CURDATE())
    `);

    // Stock position per product (on hand + average cost + value)
    const [stock] = await db.query(`
      SELECT
        p.id, p.name, p.category, p.unit, p.reorder_level,
        COALESCE(pi.qty_in, 0) - COALESCE(so.qty_out, 0)          AS on_hand,
        COALESCE(pi.avg_cost, 0)                                  AS avg_cost,
        (COALESCE(pi.qty_in,0) - COALESCE(so.qty_out,0)) * COALESCE(pi.avg_cost,0) AS stock_value
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty_in,
               SUM(quantity * buying_price) / SUM(quantity) AS avg_cost
        FROM purchases GROUP BY product_id
      ) pi ON pi.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS qty_out
        FROM sales GROUP BY product_id
      ) so ON so.product_id = p.id
      ORDER BY p.name
    `);

    const stockValue = stock.reduce((s, r) => s + Number(r.stock_value || 0), 0);
    const lowStock = stock.filter(r => r.on_hand <= r.reorder_level);

    // Batches expiring within 90 days (only for products still holding stock)
    const [expiring] = await db.query(`
      SELECT pu.batch_number, pu.expiry_date, p.name,
             DATEDIFF(pu.expiry_date, CURDATE()) AS days_left
      FROM purchases pu
      JOIN products p ON p.id = pu.product_id
      WHERE pu.expiry_date IS NOT NULL
        AND pu.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      ORDER BY pu.expiry_date ASC
      LIMIT 8
    `);

    // Best sellers this month by profit
    const [topProducts] = await db.query(`
      SELECT p.name,
             SUM(s.quantity)                                       AS units,
             SUM(s.quantity * (s.selling_price - s.cost_price))    AS profit
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE YEAR(s.sold_at) = YEAR(CURDATE()) AND MONTH(s.sold_at) = MONTH(CURDATE())
      GROUP BY p.id, p.name ORDER BY profit DESC LIMIT 5
    `);

    // Revenue by payment method today
    const [methodToday] = await db.query(`
      SELECT payment_method, COUNT(*) AS receipts, SUM(total) AS revenue
      FROM receipts WHERE status = 'paid' AND DATE(created_at) = CURDATE()
      GROUP BY payment_method ORDER BY revenue DESC
    `);

    // Who sold what today (per-seller accountability)
    const [sellerToday] = await db.query(`
      SELECT COALESCE(u.name, 'Before user tracking') AS seller_name,
             COUNT(*)                                          AS transactions,
             SUM(s.quantity * s.selling_price)                 AS revenue,
             SUM(s.quantity * (s.selling_price - s.cost_price)) AS profit
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE DATE(s.sold_at) = CURDATE()
      GROUP BY s.user_id, u.name
      ORDER BY revenue DESC
    `);

    res.render('dashboard', {
      page: 'dashboard', today, month, stock, stockValue, lowStock, expiring, topProducts, sellerToday, methodToday,
    });
  } catch (err) { next(err); }
});

// ---------- ANALYTICS (daily / weekly / monthly / yearly) ----------
const PERIODS = {
  daily: {
    label: 'Last 30 days',
    sql: `
      SELECT DATE_FORMAT(MIN(sold_at), '%d %b') AS bucket,
             SUM(quantity * selling_price)                AS revenue,
             SUM(quantity * cost_price)                   AS cost,
             SUM(quantity * (selling_price - cost_price)) AS profit
      FROM sales
      WHERE sold_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(sold_at) ORDER BY DATE(sold_at)`,
  },
  weekly: {
    label: 'Last 12 weeks',
    sql: `
      SELECT CONCAT('Wk ', WEEK(MIN(sold_at), 1)) AS bucket,
             SUM(quantity * selling_price)                AS revenue,
             SUM(quantity * cost_price)                   AS cost,
             SUM(quantity * (selling_price - cost_price)) AS profit
      FROM sales
      WHERE sold_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
      GROUP BY YEARWEEK(sold_at, 1) ORDER BY YEARWEEK(sold_at, 1)`,
  },
  monthly: {
    label: 'Last 12 months',
    sql: `
      SELECT DATE_FORMAT(MIN(sold_at), '%b %Y') AS bucket,
             SUM(quantity * selling_price)                AS revenue,
             SUM(quantity * cost_price)                   AS cost,
             SUM(quantity * (selling_price - cost_price)) AS profit
      FROM sales
      WHERE sold_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(sold_at, '%Y-%m') ORDER BY MIN(sold_at)`,
  },
  yearly: {
    label: 'All years',
    sql: `
      SELECT YEAR(sold_at) AS bucket,
             SUM(quantity * selling_price)                AS revenue,
             SUM(quantity * cost_price)                   AS cost,
             SUM(quantity * (selling_price - cost_price)) AS profit
      FROM sales
      GROUP BY YEAR(sold_at) ORDER BY YEAR(sold_at)`,
  },
};

router.get('/analytics', async (req, res, next) => {
  try {
    const period = PERIODS[req.query.period] ? req.query.period : 'daily';
    const [rows] = await db.query(PERIODS[period].sql);

    const totals = rows.reduce(
      (t, r) => ({
        revenue: t.revenue + Number(r.revenue),
        cost: t.cost + Number(r.cost),
        profit: t.profit + Number(r.profit),
      }),
      { revenue: 0, cost: 0, profit: 0 }
    );

    res.render('analytics', {
      page: 'analytics',
      period,
      periodLabel: PERIODS[period].label,
      rows,
      totals,
      chartData: JSON.stringify({
        labels: rows.map(r => String(r.bucket)),
        revenue: rows.map(r => Number(r.revenue)),
        profit: rows.map(r => Number(r.profit)),
      }),
    });
  } catch (err) { next(err); }
});

module.exports = router;
