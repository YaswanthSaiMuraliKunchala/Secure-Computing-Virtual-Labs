// Authentication middleware
module.exports = {
  // Middleware to check if user is authenticated
  isAuthenticated: (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    // Store the requested URL to redirect after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
  },

  // Middleware to check if user is NOT authenticated
  isNotAuthenticated: (req, res, next) => {
    if (!req.isAuthenticated()) {
      return next();
    }
    res.redirect('/');
  }
}; 