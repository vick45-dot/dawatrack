// Route guards. Every protected route runs through one of these.

function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function requireOwner(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'owner') return next();
  // Logged-in sellers get bounced to their sales page, others to login
  if (req.session && req.session.user) return res.redirect('/sales');
  return res.redirect('/login');
}

module.exports = { requireLogin, requireOwner };
