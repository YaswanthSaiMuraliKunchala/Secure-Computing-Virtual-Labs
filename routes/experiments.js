const express = require('express');
const router = express.Router();
const Experiment = require('../models/experiment');
const Submission = require('../models/Submission');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if user is faculty
const isFaculty = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'Faculty') {
    return res.status(403).json({ message: 'Faculty access required' });
  }
  next();
};

// Get experiments index page
router.get('/', async (req, res) => {
  try {
    // Force check authentication status
    const isLoggedIn = req.session && req.session.user ? true : false;
    const experiments = await Experiment.find().sort({ number: 1 });
    
    res.render('experiments', { 
      title: 'Experiments',
      experiments,
      user: req.session.user || null,
      isLoggedIn // explicitly add this flag
    });
  } catch (error) {
    console.error('Get experiments error:', error);
    res.render('experiments', { 
      title: 'Experiments',
      experiments: [],
      user: req.session.user || null,
      isLoggedIn: req.session && req.session.user ? true : false,
      error: 'Failed to load experiments'
    });
  }
});

// Get experiment page by slug
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const experiment = await Experiment.findOne({ slug });
    // Force check authentication status
    const isLoggedIn = req.session && req.session.user ? true : false;
    
    // Check if experiment exists in database
    if (experiment) {
      return res.render(`experiments/${slug}`, { 
        title: experiment.title,
        experiment,
        user: req.session.user || null,
        isLoggedIn // explicitly add this flag
      });
    }
    
    // Check if experiment page exists as a static file
    const experimentViewPath = path.join(__dirname, '..', 'views', 'experiments', `${slug}.ejs`);
    if (fs.existsSync(experimentViewPath)) {
      return res.render(`experiments/${slug}`, { 
        title: slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        user: req.session.user || null,
        isLoggedIn // explicitly add this flag
      });
    }
    
    // If neither found, return 404
    res.status(404).render('error', { 
      title: 'Experiment Not Found',
      message: 'The requested experiment could not be found.',
      user: req.session.user || null,
      isLoggedIn
    });
  } catch (error) {
    console.error('Get experiment error:', error);
    res.status(500).render('error', { 
      title: 'Server Error',
      message: 'An error occurred while loading the experiment.',
      user: req.session.user || null,
      isLoggedIn: req.session && req.session.user ? true : false
    });
  }
});

// API endpoint to get experiment data
router.get('/api/:slug', async (req, res) => {
  try {
    const experiment = await Experiment.findOne({ slug: req.params.slug });
    if (!experiment) {
      return res.status(404).json({ message: 'Experiment not found' });
    }
    res.json(experiment);
  } catch (error) {
    console.error('Get experiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new experiment (faculty only)
router.post('/', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { number, title, slug, aim, algorithm, sampleInput, sampleOutput, codeTemplate } = req.body;

    // Check if experiment already exists
    let experiment = await Experiment.findOne({ $or: [{ number }, { slug }] });
    if (experiment) {
      return res.status(400).json({ message: 'Experiment already exists' });
    }

    // Create new experiment
    experiment = new Experiment({
      number,
      title,
      slug,
      aim,
      algorithm,
      sampleInput,
      sampleOutput,
      codeTemplate
    });

    await experiment.save();
    res.status(201).json(experiment);
  } catch (error) {
    console.error('Create experiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update experiment (faculty only)
router.put('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { number, title, slug, aim, algorithm, sampleInput, sampleOutput, codeTemplate } = req.body;

    // Find and update experiment
    const experiment = await Experiment.findByIdAndUpdate(
      req.params.id,
      {
        number,
        title,
        slug,
        aim,
        algorithm,
        sampleInput,
        sampleOutput,
        codeTemplate
      },
      { new: true }
    );

    if (!experiment) {
      return res.status(404).json({ message: 'Experiment not found' });
    }

    res.json(experiment);
  } catch (error) {
    console.error('Update experiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete experiment (faculty only)
router.delete('/:id', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const experiment = await Experiment.findByIdAndDelete(req.params.id);
    if (!experiment) {
      return res.status(404).json({ message: 'Experiment not found' });
    }
    res.json({ message: 'Experiment deleted successfully' });
  } catch (error) {
    console.error('Delete experiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit experiment
router.post('/:id/submit', isAuthenticated, async (req, res) => {
  try {
    const { code, output } = req.body;
    const experimentId = req.params.id;
    const userId = req.session.user._id;

    // Check if experiment exists
    const experiment = await Experiment.findById(experimentId);
    if (!experiment) {
      return res.status(404).json({ message: 'Experiment not found' });
    }

    // Create submission
    const submission = new Submission({
      experiment: experimentId,
      student: userId,
      code,
      output
    });

    await submission.save();

    // Update user progress
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`progress.${experimentId}`]: {
          completed: true,
          submissionDate: new Date()
        }
      }
    });

    res.status(201).json({
      message: 'Submission successful',
      submission
    });
  } catch (error) {
    console.error('Submit experiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit experiment by number
router.post('/:number/submit', isAuthenticated, async (req, res) => {
  try {
    const { code, output } = req.body;
    const experimentNumber = req.params.number;
    const userId = req.session.user._id;

    // Find experiment by number
    const experiment = await Experiment.findOne({ number: experimentNumber });
    if (!experiment) {
      return res.status(404).json({ message: 'Experiment not found' });
    }

    // Create submission
    const submission = new Submission({
      experiment: experiment._id,
      student: userId,
      code,
      output
    });

    await submission.save();

    // Update user progress
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`progress.${experiment._id}`]: {
          completed: true,
          submissionDate: new Date()
        }
      }
    });

    res.status(201).json({
      message: 'Submission successful',
      submission
    });
  } catch (error) {
    console.error('Submit experiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user submissions for an experiment
router.get('/:id/submissions', isAuthenticated, async (req, res) => {
  try {
    const experimentId = req.params.id;
    const userId = req.session.user._id;

    const submissions = await Submission.find({
      experiment: experimentId,
      student: userId
    }).sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all submissions for an experiment (faculty only)
router.get('/:id/all-submissions', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const experimentId = req.params.id;

    const submissions = await Submission.find({
      experiment: experimentId
    })
      .populate('student', 'username email')
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get all submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Evaluate submission (faculty only)
router.put('/submissions/:id/evaluate', isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const submissionId = req.params.id;
    const facultyId = req.session.user._id;

    // Find and update submission
    const submission = await Submission.findByIdAndUpdate(
      submissionId,
      {
        grade,
        feedback,
        status: 'evaluated',
        evaluatedBy: facultyId,
        evaluatedAt: new Date()
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Update user progress with grade and feedback
    await User.findByIdAndUpdate(submission.student, {
      $set: {
        [`progress.${submission.experiment}`]: {
          completed: true,
          submissionDate: submission.submittedAt,
          grade,
          feedback
        }
      }
    });

    res.json({
      message: 'Evaluation successful',
      submission
    });
  } catch (error) {
    console.error('Evaluate submission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 