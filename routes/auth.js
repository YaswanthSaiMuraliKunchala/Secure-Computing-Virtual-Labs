const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Helper function to detect role from email
function detectRoleFromEmail(email) {
    if (!email || !email.endsWith('@klu.ac.in')) {
        return null;
    }
    
    // Extract the part before @klu.ac.in
    const username = email.split('@')[0];
    
    // Check if it's a student email (starts with 9-12 digits)
    if (/^\d{9,12}/.test(username)) {
        return 'student';
    }
    
    // Check if it's a faculty email (starts with letters)
    if (/^[a-zA-Z]/.test(username)) {
        return 'faculty';
    }
    
    return null;
}

// Validate KLU email
function validateKLUEmail(email) {
    if (!email || !email.endsWith('@klu.ac.in')) {
        return false;
    }
    
    // Extract the part before @klu.ac.in
    const username = email.split('@')[0];
    
    // Check if it's a student email (starts with 9-12 digits)
    if (/^\d{9,12}/.test(username)) {
        return true;
    }
    
    // Check if it's a faculty email (starts with letters)
    if (/^[a-zA-Z]/.test(username)) {
        return true;
    }
    
    return false;
}

// OTP storage (in production, use Redis or database)
const otpStore = new Map();

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com', // Use environment variable
    pass: process.env.EMAIL_PASS || 'your-app-password'     // Use environment variable
  }
});

// For development/testing - skip actual email sending
const sendEmailInDevelopment = false; // Set to false to actually send emails in production

// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: 'Password Reset OTP - Secured Computing Virtual Lab',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Password Reset Verification</h2>
        <p>You are receiving this email because you (or someone else) has requested to reset the password for your account.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h3 style="margin: 0; color: #333;">Your verification code is:</h3>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 10px 0; color: #4a6ee0;">${otp}</p>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #777; font-size: 12px; text-align: center;">Secured Computing Virtual Lab - Kalasalingam Academy of Research and Education</p>
      </div>
    `
  };

  // For development/testing, log instead of sending
  if (!sendEmailInDevelopment) {
    console.log('Development mode: Email would be sent to:', email);
    console.log('OTP code is:', otp);
    return Promise.resolve({ messageId: 'dev-mode' });
  }

  // Send actual email
  return transporter.sendMail(mailOptions);
}

// Login page
router.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { error: null });
});

// Register page
router.get('/register', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('auth/register', { error: null });
});

// Google auth routes
router.get('/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account',
        accessType: 'offline'
    })
);

router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/auth/login',
        failureFlash: 'Invalid Google credentials'
    }),
    (req, res) => {
        // After successful Google authentication
        if (req.user) {
            // Update last login
            req.user.lastLogin = new Date();
            req.user.save().then(() => {
                // Redirect based on role
                if (req.user.role === 'faculty') {
                    res.redirect('/faculty/dashboard');
                } else {
                    res.redirect('/');
                }
            }).catch(err => {
                console.error('Error updating last login:', err);
                res.redirect('/');
            });
        } else {
            res.redirect('/auth/login');
        }
    }
);

// Register handler
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate KLU email domain
        if (!validateKLUEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Only KLU domain emails (@klu.ac.in) are allowed'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }

        // Create new user
        const user = new User({
            username,
            email,
            password,
            role: detectRoleFromEmail(email)
        });

        await user.save();

        // Set session
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile
        };

        res.json({
            success: true,
            message: 'Registration successful',
            user: user.getProfile()
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

// Login handler
router.post('/login', (req, res, next) => {
    // Validate input
    if (!req.body.email || !req.body.password) {
        if (req.xhr) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        req.flash('error', 'Email and password are required');
        return res.redirect('/auth/login');
    }

    // Validate KLU email
    if (!validateKLUEmail(req.body.email)) {
        if (req.xhr) {
            return res.status(400).json({ message: 'Only KLU domain emails (@klu.ac.in) are allowed' });
        }
        req.flash('error', 'Only KLU domain emails (@klu.ac.in) are allowed');
        return res.redirect('/auth/login');
    }

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Authentication error:', err);
            if (req.xhr) {
                return res.status(500).json({ message: 'An error occurred during login.' });
            }
            return next(err);
        }
        
        if (!user) {
            if (req.xhr) {
                return res.status(401).json({ message: info.message || 'Invalid email or password.' });
            }
            req.flash('error', info.message || 'Invalid email or password.');
            return res.redirect('/auth/login');
        }
        
        req.logIn(user, (err) => {
            if (err) {
                console.error('Login error:', err);
                if (req.xhr) {
                    return res.status(500).json({ message: 'An error occurred during login.' });
                }
                return next(err);
            }
            
            // Update last login time
            user.lastLogin = new Date();
            user.save().catch(err => console.error('Error updating last login:', err));
            
            if (req.xhr) {
                // Return success response for AJAX requests
                return res.status(200).json({ 
                    message: 'Login successful',
                    user: {
                        id: user._id,
                        email: user.email,
                        role: user.role
                    },
                    redirectUrl: '/profile'
                });
            }
            
            // Redirect for traditional form submissions
            return res.redirect('/profile');
        });
    })(req, res, next);
});

// Logout route
router.post('/logout', (req, res) => {
  // Logout with Passport
  req.logout(function(err) {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      
      // Clear the cookie
      res.clearCookie('connect.sid');
      
      // Redirect to login page
      res.redirect('/auth/login');
    });
    });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

// Render forgot password page
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { 
    title: 'Forgot Password',
    otpSent: false,
    otpVerified: false
  });
});

// Send OTP route
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !validateKLUEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid KLU email address'
      });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address'
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    const expiration = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, {
      otp,
      expiration,
      attempts: 0
    });
    
    try {
      // Send OTP email
      await sendOTPEmail(email, otp);
      
      // Return success response
      return res.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // For development, allow continuing even if email fails
      if (!sendEmailInDevelopment) {
        console.log('Development mode: Proceeding despite email error');
        console.log('OTP code for testing:', otp);
        
        return res.json({
          success: true,
          message: 'Development mode: Check console for OTP code'
        });
      }
      
      // In production, show error
      return res.status(500).json({
        success: false,
        message: 'An error occurred while sending the verification code'
      });
    }
    
  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request'
    });
  }
});

// Resend OTP route
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !validateKLUEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid KLU email address'
      });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address'
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    const expiration = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, {
      otp,
      expiration,
      attempts: 0
    });
    
    try {
      // Send OTP email
      await sendOTPEmail(email, otp);
      
      // Return success response
      return res.json({
        success: true,
        message: 'Verification code resent to your email'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // For development, allow continuing even if email fails
      if (!sendEmailInDevelopment) {
        console.log('Development mode: Proceeding despite email error');
        console.log('OTP code for testing:', otp);
        
        return res.json({
          success: true,
          message: 'Development mode: Check console for OTP code'
        });
      }
      
      // In production, show error
      return res.status(500).json({
        success: false,
        message: 'An error occurred while sending the verification code'
      });
    }
    
  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request'
    });
  }
});

// Verify OTP route
router.post('/verify-otp', async (req, res) => {
  try {
    // Support both JSON and form-urlencoded formats
    let email = req.body.email;
    let otp = req.body.otp;
    
    // If the OTP is coming from the form with separate inputs, combine them
    if (!otp && req.body.otp1) {
      otp = [
        req.body.otp1 || '',
        req.body.otp2 || '',
        req.body.otp3 || '',
        req.body.otp4 || '',
        req.body.otp5 || '',
        req.body.otp6 || ''
      ].join('');
    }
    
    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }
    
    // Check if OTP exists for email
    const otpData = otpStore.get(email);
    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired or not found'
      });
    }
    
    // Check OTP expiration
    if (Date.now() > otpData.expiration) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired'
      });
    }
    
    // Increment attempts
    otpData.attempts += 1;
    
    // Check max attempts (5)
    if (otpData.attempts > 5) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts'
      });
    }
    
    // Verify OTP
    if (otpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    // Generate reset token
    const token = crypto.randomBytes(20).toString('hex');
    
    // Store token in OTP data
    otpData.token = token;
    otpStore.set(email, otpData);
    
    // Return success with token
    return res.json({
      success: true,
      message: 'Verification successful',
      token: token
    });
    
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying the code'
    });
  }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
  try {
    const email = req.body.email;
    const token = req.body.token;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;
    
    // Validate inputs
    if (!email || !token || !password) {
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      } else {
        return res.render('auth/forgot-password', {
          title: 'Reset Password',
          email,
          token,
          otpSent: true,
          otpVerified: true,
          error: 'All fields are required'
        });
      }
    }
    
    // Check if passwords match (for form submissions)
    if (confirmPassword && password !== confirmPassword) {
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      } else {
        return res.render('auth/forgot-password', {
          title: 'Reset Password',
          email,
          token,
          otpSent: true,
          otpVerified: true,
          error: 'Passwords do not match'
        });
      }
    }
    
    // Check password length
    if (password.length < 8) {
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters'
        });
      } else {
        return res.render('auth/forgot-password', {
          title: 'Reset Password',
          email,
          token,
          otpSent: true,
          otpVerified: true,
          error: 'Password must be at least 8 characters'
        });
      }
    }
    
    // Verify token
    const otpData = otpStore.get(email);
    if (!otpData || otpData.token !== token) {
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired token'
        });
      } else {
        return res.render('auth/forgot-password', {
          title: 'Reset Password',
          email,
          otpSent: true,
          otpVerified: false,
          error: 'Invalid or expired token. Please request a new code.'
        });
      }
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        return res.render('auth/forgot-password', {
          title: 'Reset Password',
          email,
          otpSent: true,
          otpVerified: false,
          error: 'User not found'
        });
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    // Update user password
    user.password = hash;
    await user.save();
    
    // Clean up OTP data
    otpStore.delete(email);
    
    // Return response based on request type
    if (req.xhr || req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } else {
      // Set flash message and redirect to login
      req.flash('success', 'Password has been reset successfully. Please log in with your new password.');
      return res.redirect('/auth/login');
    }
    
  } catch (error) {
    console.error('Password reset error:', error);
    
    if (req.xhr || req.headers.accept.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: 'An error occurred while resetting your password'
      });
    } else {
      return res.render('auth/forgot-password', {
        title: 'Reset Password',
        email: req.body.email,
        token: req.body.token,
        otpSent: true,
        otpVerified: true,
        error: 'An error occurred while resetting your password. Please try again.'
      });
    }
  }
});

// Request OTP route (legacy form submission)
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email || !validateKLUEmail(email)) {
      return res.render('auth/forgot-password', { 
        title: 'Forgot Password',
        error: 'Please provide a valid KLU email address',
        otpSent: false
      });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/forgot-password', { 
        title: 'Forgot Password',
        error: 'No account found with that email address',
        otpSent: false
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    const expiration = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, {
      otp,
      expiration,
      attempts: 0
    });
    
    try {
      // Send OTP email
      await sendOTPEmail(email, otp);
      
      // Render page with OTP sent status
      res.render('auth/forgot-password', {
        title: 'Verify OTP',
        email,
        otpSent: true,
        otpVerified: false,
        success: 'Verification code has been sent to your email'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // For development, allow continuing even if email fails
      if (!sendEmailInDevelopment) {
        console.log('Development mode: Proceeding despite email error');
        console.log('OTP code for testing:', otp);
        
        return res.render('auth/forgot-password', {
          title: 'Verify OTP',
          email,
          otpSent: true,
          otpVerified: false,
          success: 'Development mode: Check console for OTP code'
        });
      }
      
      // In production, show error
      return res.render('auth/forgot-password', {
        title: 'Forgot Password',
        error: 'An error occurred while sending the verification code. Please try again later.',
        otpSent: false
      });
    }
    
  } catch (error) {
    console.error('OTP request error:', error);
    res.render('auth/forgot-password', {
      title: 'Forgot Password',
      error: 'An error occurred while processing your request. Please try again.',
      otpSent: false
    });
  }
});

module.exports = router; 