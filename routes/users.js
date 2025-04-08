const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Submission = require('../models/Submission');
const bcrypt = require('bcrypt');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if user is faculty
const isFaculty = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'faculty') {
    return res.status(403).json({ message: 'Faculty access required' });
  }
  next();
};

// Get user profile - API
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile - API
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const { username, email } = req.body;
    
    // Check if username or email already exists
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: req.session.user.id } },
        { $or: [{ username }, { email }] }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already in use' });
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.session.user.id,
      { $set: req.body },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password - API
router.put('/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Find user
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user progress - API
router.get('/progress', isAuthenticated, async (req, res) => {
  try {
    const submissions = await Submission.find({ user: req.session.user.id });
    
    // Group submissions by experiment
    const progress = {};
    submissions.forEach(submission => {
      if (!progress[submission.experiment]) {
        progress[submission.experiment] = {
          completed: submission.status === 'completed',
          score: submission.score,
          submittedAt: submission.createdAt
        };
      } else if (submission.status === 'completed' && !progress[submission.experiment].completed) {
        progress[submission.experiment] = {
          completed: true,
          score: submission.score,
          submittedAt: submission.createdAt
        };
      }
    });
    
    res.json({ progress });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Render student profile page
router.get('/student/profile', isAuthenticated, async (req, res) => {
  try {
    if (req.session.user.role !== 'student') {
      return res.redirect('/profile');
    }
    
    const user = await User.findById(req.session.user.id).select('-password');
    if (!user) {
      return res.status(404).render('error', { 
        title: 'User Not Found',
        message: 'The requested user could not be found.',
        statusCode: 404
      });
    }
    
    const submissions = await Submission.find({ user: req.session.user.id })
      .populate('experiment')
      .sort({ createdAt: -1 });
    
    res.render('student/profile', { 
      title: 'Student Profile',
      user,
      submissions
    });
  } catch (error) {
    console.error('Student profile error:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'Something went wrong on our end.',
      statusCode: 500
    });
  }
});

// Render settings page
router.get('/settings', isAuthenticated, (req, res) => {
  res.render('users/settings', {
    title: 'Settings',
    user: req.session.user,
    isLoggedIn: true
  });
});

// Get all users (faculty only)
router.get('/', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const users = await User.find({ role: 'student' }).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID (faculty only)
router.get('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user submissions
    const submissions = await Submission.find({ student: req.params.id })
      .populate('experiment', 'number title slug')
      .sort({ submittedAt: -1 });
    
    res.json({
      user,
      submissions
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user (faculty only)
router.post('/', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create new user
    user = new User({
      username,
      email,
      password,
      role: role || 'student'
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (faculty only)
router.put('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { username, email, role } = req.body;
    
    // Check if username or email already exists
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { $or: [{ username }, { email }] }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already in use' });
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (faculty only)
router.delete('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete all user submissions
    await Submission.deleteMany({ student: req.params.id });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// API route to update profile
router.post('/api/users/profile', isAuthenticated, async (req, res) => {
  try {
    const { username, email, firstName, lastName, bio, department, rollNumber } = req.body;
    const userId = req.session.user._id;

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        username,
        email,
        firstName,
        lastName,
        bio,
        department,
        rollNumber
      },
      { new: true }
    );

    // Update session
    req.session.user = updatedUser;
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.json({
      success: false,
      message: 'Failed to update profile: ' + error.message
    });
  }
});

// API route to change password
router.post('/api/users/changePassword', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user._id;

    // Get user from database
    const user = await User.findById(userId);
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.json({
      success: false,
      message: 'Failed to update password: ' + error.message
    });
  }
});

// API route to update notification preferences
router.post('/api/users/notifications', isAuthenticated, async (req, res) => {
  try {
    const { emailNotifications, experimentUpdates, progressReminders } = req.body;
    const userId = req.session.user._id;

    // Update user preferences
    await User.findByIdAndUpdate(userId, {
      notificationPreferences: {
        emailNotifications: emailNotifications === 'on',
        experimentUpdates: experimentUpdates === 'on',
        progressReminders: progressReminders === 'on'
      }
    });
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Notification preferences update error:', error);
    res.json({
      success: false,
      message: 'Failed to update notification preferences: ' + error.message
    });
  }
});

// API route to delete account
router.post('/api/users/delete', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    // Delete user
    await User.findByIdAndDelete(userId);
    
    // Clear session
    req.session.destroy();
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.json({
      success: false,
      message: 'Failed to delete account: ' + error.message
    });
  }
});

module.exports = router; 