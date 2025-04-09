const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const dotenv = require('dotenv');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const Experiment = require('./models/Experiment');
const User = require('./models/User');
const flash = require('connect-flash');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env file from:', envPath);
dotenv.config({ path: envPath });

// Initialize Express app
const app = express();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://yaswanthsaimurali33:123sai45@cluster1.yue59.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file middleware with logging for debugging
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.static(path.join(__dirname, 'public')));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || '123sai45',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Debug environment variables
console.log('Environment variables loaded:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);

// Hardcoded values for Google OAuth (from .env)
const googleClientID = "366421007739-ufdei61g8pg81m837t3lkti13n1q5dpi.apps.googleusercontent.com";
const googleClientSecret = "yGOCSPX-ULPhXA8Tgr64GuY8xrG3SLRd-ZLW";
const googleCallbackURL = "http://localhost:3000/auth/google/callback";

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: googleClientID,
    clientSecret: googleClientSecret,
    callbackURL: googleCallbackURL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        
        // Validate KLU email
        if (!email.endsWith('@klu.ac.in')) {
            return done(null, false, { message: 'Only KLU domain emails (@klu.ac.in) are allowed' });
        }
        
        // Extract username and detect role
        const username = email.split('@')[0];
        let role;
        
        // Check if it's a student email (starts with 9-12 digits)
        if (/^\d{9,12}/.test(username)) {
            role = 'student';
        }
        // Check if it's a faculty email (starts with letters)
        else if (/^[a-zA-Z]/.test(username)) {
            role = 'faculty';
        }
        else {
            return done(null, false, { message: 'Invalid email format for KLU domain' });
        }
        
        // Find or create user
        let user = await User.findOne({ email });
        let isNewUser = false;
        
        if (!user) {
            // Create new user
            user = new User({
                username,
                email,
                role,
                googleAuth: true,
                lastLogin: new Date()
            });
            
            // Save the new user
            await user.save();
            isNewUser = true;
            console.log('New user created:', user.email);
        } else {
            // Update existing user's last login
            user.lastLogin = new Date();
            await user.save();
            console.log('Existing user logged in:', user.email);
        }
        
        // Send welcome/notification email
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: isNewUser ? 'Welcome to Secured Computing Virtual Lab' : 'Login Notification',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">${isNewUser ? 'Welcome to Secured Computing Virtual Lab!' : 'Login Notification'}</h2>
                        <p>Hello ${username},</p>
                        <p>${isNewUser ? 
                            'Thank you for registering with the Secured Computing Virtual Lab. You can now access all the experiments and track your progress.' : 
                            'You have successfully logged in to the Secured Computing Virtual Lab.'}</p>
                        <p>If you did not perform this action, please contact the administrator immediately.</p>
                        <p>Best regards,<br>Secured Computing Virtual Lab Team</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully to:', email);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            // Don't fail the login process if email fails
        }
        
        return done(null, user);
    } catch (error) {
        console.error('Google authentication error:', error);
        return done(error);
    }
}));

// Configure Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  
  // Calculate progress for the user if logged in
  if (req.user) {
    const completedCount = req.user.completedExperiments.length;
    const totalExperiments = 14;
    const progressPercentage = (completedCount / totalExperiments) * 100;
    
    res.locals.completedCount = completedCount;
    res.locals.progressPercentage = progressPercentage;
  }
  
  next();
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if user is faculty
const isFaculty = (req, res, next) => {
  if (!req.user || req.user.role !== 'faculty') {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if user is student
const isStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.redirect('/auth/login');
  }
  next();
};

// Routes
const authRoutes = require('./routes/auth');
const experimentRoutes = require('./routes/experiments');
const userRoutes = require('./routes/users');
const testRoutes = require('./routes/tests');

// Register routes
app.use('/auth', authRoutes);
app.use('/experiments', experimentRoutes);
app.use('/users', userRoutes);
app.use('/tests', testRoutes);

// Settings redirect
app.get('/settings', (req, res) => {
  res.redirect('/users/settings');
});

// Home/Index route
app.get(['/', '/index'], async (req, res) => {
  try {
    // Get all experiments
    const experiments = await Experiment.find().sort({ number: 1 });
    
    // If user is not logged in, show the landing page
    if (!req.user) {
      return res.render('index', {
        title: 'Welcome to Secured Computing Lab',
        experiments,
        user: null,
        role: null,
        completedCount: 0,
        progressPercentage: 0
      });
    }

    // For logged-in users, determine their role and show appropriate content
    if (req.user.role === 'faculty') {
      return res.redirect('/faculty/dashboard');
    }

    // For students, show the student dashboard
    const completedCount = req.user.completedExperiments.length;
    const totalExperiments = 14;
    const progressPercentage = (completedCount / totalExperiments) * 100;

    return res.render('index', {
      title: 'Student Dashboard',
      experiments,
      user: req.user,
      role: 'student',
      completedCount,
      progressPercentage
    });

  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load the page. Please try again later.',
      user: req.user || null
    });
  }
});

// Auth page routes - these are duplicates of routes in auth.js but kept for backward compatibility
app.get('/auth/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', { title: 'Login' });
});

app.get('/auth/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', { title: 'Register' });
});

app.get('/auth/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password' });
});

// Redirect GET logout requests to login
app.get('/auth/logout', (req, res) => {
  res.redirect('/auth/login');
});

// Faculty routes
app.get('/faculty/dashboard', isFaculty, (req, res) => {
  res.render('faculty/dashboard', { 
    title: 'Faculty Dashboard',
    active: 'dashboard'
  });
});

app.get('/faculty/students', isFaculty, (req, res) => {
  res.render('faculty/students', { 
    title: 'Manage Students',
    active: 'students'
  });
});

app.get('/faculty/tests', isFaculty, (req, res) => {
  res.render('faculty/tests', { 
    title: 'Manage Tests',
    active: 'tests'
  });
});

app.get('/faculty/tests/create', isFaculty, (req, res) => {
  res.render('faculty/create-test', { 
    title: 'Create New Test',
    active: 'tests'
  });
});

app.get('/faculty/submissions', isFaculty, (req, res) => {
  res.render('faculty/submissions', { 
    title: 'Student Submissions',
    active: 'submissions'
  });
});

app.get('/faculty/reports', isFaculty, (req, res) => {
  res.render('faculty/reports', { 
    title: 'Reports',
    active: 'reports'
  });
});

app.get('/faculty/settings', isFaculty, (req, res) => {
  res.render('faculty/settings', { 
    title: 'Faculty Settings',
    active: 'settings'
  });
});

// Student routes
app.get('/student/profile', isStudent, (req, res) => {
  res.render('student/profile', { 
    title: 'Student Profile',
    active: 'profile'
  });
});

// Profile route
app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/');
        }

        // Get user's experiment progress
        const completedExperiments = await Experiment.find({
            _id: { $in: user.completedExperiments }
        }).sort('number');

        // Calculate progress
        const totalExperiments = 14; // Total number of experiments
        const completedCount = user.completedExperiments.length;
        const progressPercentage = Math.round((completedCount / totalExperiments) * 100);

        res.render('profile', {
            title: 'My Profile',
            user: user,
            completedExperiments,
            progressPercentage,
            totalExperiments,
            completedCount
        });
    } catch (error) {
        console.error('Profile error:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/');
    }
});

// About page
app.get('/about', (req, res) => {
  res.render('about', { 
    title: 'About Secured Computing Lab',
    active: 'about'
  });
});

// 404 handler - must be before the error handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    statusCode: 404,
    user: req.user || null
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Determine the error type and message
  let statusCode = 500;
  let message = 'Something went wrong!';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid input data. Please check your input and try again.';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'You are not authorized to perform this action.';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'The requested resource was not found.';
  }
  
  res.status(statusCode).render('error', {
    title: 'Error',
    message: message,
    statusCode: statusCode,
    user: req.user || null
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 