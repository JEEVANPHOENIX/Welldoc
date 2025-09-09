const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

// Session setup
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Authentication check
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login.html');
}

// Root → redirect to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Serve login.html
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login form
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Simple check – replace with DB validation in production
  if (username && password) {
    req.session.user = username;
    return res.redirect('/dashboard.html');
  }
  res.redirect('/login.html');
});

// Serve dashboard.html only if authenticated
app.get('/dashboard.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Logout endpoint
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}/login.html`);
});
