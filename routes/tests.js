const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const User = require('../models/User');
const Experiment = require('../models/experiment');
const Submission = require('../models/Submission');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
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

// Get all tests
router.get('/', isAuthenticated, async (req, res) => {
  try {
    let tests;
    
    if (req.session.user.role === 'faculty') {
      // Faculty can see all tests they created
      tests = await Test.find({ createdBy: req.session.user.id })
        .populate('experiments', 'number title slug')
        .sort({ startTime: -1 });
    } else {
      // Students can see tests they are participants in
      tests = await Test.find({
        'participants.student': req.session.user.id,
        startTime: { $lte: new Date() } // Only show tests that have started
      })
        .populate('experiments', 'number title slug')
        .sort({ startTime: -1 });
    }
    
    res.json(tests);
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get test by ID
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('experiments', 'number title slug aim algorithm sampleInput sampleOutput')
      .populate('createdBy', 'username email');
    
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Check if user is authorized to view this test
    if (req.session.user.role === 'student') {
      const isParticipant = test.participants.some(
        p => p.student.toString() === req.session.user.id
      );
      
      if (!isParticipant) {
        return res.status(403).json({ message: 'Not authorized to view this test' });
      }
      
      // Check if test has started
      if (new Date() < test.startTime) {
        return res.status(403).json({ message: 'Test has not started yet' });
      }
    }
    
    res.json(test);
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new test (faculty only)
router.post('/', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { title, description, startTime, endTime, duration, experimentIds, participantIds } = req.body;
    
    // Validate experiments
    const experiments = await Experiment.find({ _id: { $in: experimentIds } });
    if (experiments.length !== experimentIds.length) {
      return res.status(400).json({ message: 'One or more experiments not found' });
    }
    
    // Validate participants
    const participants = await User.find({ 
      _id: { $in: participantIds },
      role: 'student'
    });
    
    if (participants.length !== participantIds.length) {
      return res.status(400).json({ message: 'One or more participants not found or not students' });
    }
    
    // Create test
    const test = new Test({
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration,
      experiments: experimentIds,
      createdBy: req.session.user.id,
      participants: participantIds.map(id => ({ student: id }))
    });
    
    await test.save();
    
    res.status(201).json(test);
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update test (faculty only)
router.put('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { title, description, startTime, endTime, duration, experimentIds, participantIds, isActive } = req.body;
    
    // Find test
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Check if user is the creator
    if (test.createdBy.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this test' });
    }
    
    // Validate experiments if provided
    if (experimentIds) {
      const experiments = await Experiment.find({ _id: { $in: experimentIds } });
      if (experiments.length !== experimentIds.length) {
        return res.status(400).json({ message: 'One or more experiments not found' });
      }
    }
    
    // Validate participants if provided
    if (participantIds) {
      const participants = await User.find({ 
        _id: { $in: participantIds },
        role: 'student'
      });
      
      if (participants.length !== participantIds.length) {
        return res.status(400).json({ message: 'One or more participants not found or not students' });
      }
    }
    
    // Update test
    const updatedTest = await Test.findByIdAndUpdate(
      req.params.id,
      {
        title: title || test.title,
        description: description || test.description,
        startTime: startTime ? new Date(startTime) : test.startTime,
        endTime: endTime ? new Date(endTime) : test.endTime,
        duration: duration || test.duration,
        experiments: experimentIds || test.experiments,
        participants: participantIds ? participantIds.map(id => ({ student: id })) : test.participants,
        isActive: isActive !== undefined ? isActive : test.isActive
      },
      { new: true }
    );
    
    res.json(updatedTest);
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete test (faculty only)
router.delete('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    // Find test
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Check if user is the creator
    if (test.createdBy.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this test' });
    }
    
    // Delete test
    await Test.findByIdAndDelete(req.params.id);
    
    // Delete all submissions for this test
    await Submission.deleteMany({ test: req.params.id });
    
    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start test (student)
router.post('/:id/start', isAuthenticated, async (req, res) => {
  try {
    // Find test
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Check if user is a participant
    const participantIndex = test.participants.findIndex(
      p => p.student.toString() === req.session.user.id
    );
    
    if (participantIndex === -1) {
      return res.status(403).json({ message: 'Not authorized to take this test' });
    }
    
    // Check if test has started
    const now = new Date();
    if (now < test.startTime) {
      return res.status(400).json({ message: 'Test has not started yet' });
    }
    
    // Check if test has ended
    if (now > test.endTime) {
      return res.status(400).json({ message: 'Test has already ended' });
    }
    
    // Check if test is already in progress or submitted
    if (test.participants[participantIndex].status !== 'not_started') {
      return res.status(400).json({ message: `Test is already ${test.participants[participantIndex].status}` });
    }
    
    // Update participant status
    test.participants[participantIndex].status = 'in_progress';
    test.participants[participantIndex].startedAt = now;
    
    await test.save();
    
    res.json({
      message: 'Test started successfully',
      test
    });
  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit test (student)
router.post('/:id/submit', isAuthenticated, async (req, res) => {
  try {
    // Find test
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Check if user is a participant
    const participantIndex = test.participants.findIndex(
      p => p.student.toString() === req.session.user.id
    );
    
    if (participantIndex === -1) {
      return res.status(403).json({ message: 'Not authorized to submit this test' });
    }
    
    // Check if test is in progress
    if (test.participants[participantIndex].status !== 'in_progress') {
      return res.status(400).json({ message: 'Test is not in progress' });
    }
    
    // Update participant status
    test.participants[participantIndex].status = 'submitted';
    test.participants[participantIndex].submittedAt = new Date();
    
    await test.save();
    
    res.json({
      message: 'Test submitted successfully',
      test
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get test submissions (faculty only)
router.get('/:id/submissions', isAuthenticated, isFaculty, async (req, res) => {
  try {
    // Find test
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    
    // Check if user is the creator
    if (test.createdBy.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this test' });
    }
    
    // Get all submissions for this test
    const submissions = await Submission.find({ test: req.params.id })
      .populate('student', 'username email')
      .populate('experiment', 'number title slug')
      .sort({ submittedAt: -1 });
    
    res.json(submissions);
  } catch (error) {
    console.error('Get test submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 