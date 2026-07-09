require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { requireLogin, requireOwner } = require('./middleware/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }, // 12-hour shifts
}));

// Make the logged-in user available to every view
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// KES money formatting helper for views
app.locals.kes = (n) =>
  'KES ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Public: login/logout
app.use('/', require('./routes/auth'));

// Sellers + owner: recording sales
app.use('/sales', requireLogin, require('./routes/sales'));

// Owner only: everything else
app.use('/products', requireOwner, require('./routes/products'));
app.use('/purchases', requireOwner, require('./routes/purchases'));
app.use('/users', requireOwner, require('./routes/users'));
app.use('/', requireOwner, require('./routes/dashboard'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong: ' + err.message);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`DawaTrack running on http://localhost:${PORT}`)
);
