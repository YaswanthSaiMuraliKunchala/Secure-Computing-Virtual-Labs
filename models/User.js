const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                // Only allow @klu.ac.in emails
                if (!v.endsWith('@klu.ac.in')) {
                    return false;
                }
                
                // Extract the part before @klu.ac.in
                const username = v.split('@')[0];
                
                // Check if it's a student email (starts with 9-12 digits)
                if (/^\d{9,12}/.test(username)) {
                    return true;
                }
                
                // Check if it's a faculty email (starts with letters)
                if (/^[a-zA-Z]/.test(username)) {
                    return true;
                }
                
                return false;
            },
            message: props => `${props.value} is not a valid KLU email address!`
        }
    },
    password: {
        type: String,
        required: function() {
            return !this.googleAuth; // Password is required only if not using Google auth
        },
        minlength: 6
    },
    googleAuth: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['student', 'faculty'],
        required: true
    },
    completedExperiments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Experiment'
    }],
    profile: {
        name: String,
        department: String,
        year: Number,
        section: String,
        rollNumber: String
    },
    experimentProgress: {
        type: Map,
        of: {
            completed: { type: Boolean, default: false },
            completedAt: Date,
            score: Number,
            attempts: { type: Number, default: 0 }
        },
        default: new Map()
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Virtual for progress calculation
userSchema.virtual('progressPercentage').get(function() {
    const totalExperiments = 14; // Total number of experiments
    const completedCount = this.completedExperiments.length;
    return (completedCount / totalExperiments) * 100;
});

// Method to update last login
userSchema.methods.updateLastLogin = async function() {
    this.lastLogin = new Date();
    await this.save();
};

// Method to check if experiment is completed
userSchema.methods.isExperimentCompleted = function(experimentId) {
    return this.completedExperiments.includes(experimentId);
};

// Method to mark experiment as completed
userSchema.methods.completeExperiment = async function(experimentId) {
    if (!this.isExperimentCompleted(experimentId)) {
        this.completedExperiments.push(experimentId);
        await this.save();
        return true;
    }
    return false;
};

// Method to get user profile (excluding sensitive data)
userSchema.methods.getProfile = function() {
    return {
        id: this._id,
        username: this.username,
        email: this.email,
        role: this.role,
        profile: this.profile,
        progress: this.progressPercentage,
        completedExperiments: this.completedExperiments.length
    };
};

// Method to detect role from email
userSchema.methods.detectRole = function() {
    const username = this.email.split('@')[0];
    return /^\d{9,12}$/.test(username) ? 'student' : 'faculty';
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 