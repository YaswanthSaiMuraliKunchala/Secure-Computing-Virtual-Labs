const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Home page route
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Home - Secured Computing Virtual Lab',
    active: 'home',
    user: req.user
  });
});

// Experiments list route
router.get('/experiments', (req, res) => {
  res.render('experiments/index', {
    title: 'Experiments - Secured Computing Virtual Lab',
    active: 'experiments',
    user: req.user
  });
});

// Individual experiment routes
router.get('/experiments/:slug', authMiddleware.isAuthenticated, (req, res) => {
  res.render(`experiments/${req.params.slug}`, {
    title: `${req.params.slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} - Secured Computing Virtual Lab`,
    active: 'experiments',
    user: req.user
  });
});

// Authentication routes
router.get('/auth/login', authMiddleware.isNotAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login - Secured Computing Virtual Lab',
    active: 'login',
    user: req.user
  });
});

router.get('/auth/register', authMiddleware.isNotAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Register - Secured Computing Virtual Lab',
    active: 'register',
    user: req.user
  });
});

router.post('/auth/login', authMiddleware.isNotAuthenticated, (req, res) => {
  // Handle login logic here
});

router.post('/auth/register', authMiddleware.isNotAuthenticated, (req, res) => {
  // Handle registration logic here
});

// Profile routes
router.get('/profile', authMiddleware.isAuthenticated, (req, res) => {
  res.render('profile', {
    title: 'Profile - Secured Computing Virtual Lab',
    active: 'profile',
    user: req.user
  });
});

// Settings routes
router.get('/settings', authMiddleware.isAuthenticated, (req, res) => {
  res.render('settings', {
    title: 'Settings - Secured Computing Virtual Lab',
    active: 'settings',
    user: req.user
  });
});

module.exports = router; 