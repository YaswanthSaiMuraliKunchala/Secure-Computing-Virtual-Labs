const mongoose = require('mongoose');

const experimentSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    steps: [{
        type: String,
        required: true
    }],
    expectedOutput: {
        type: String,
        required: true
    },
    defaultCode: {
        type: String,
        default: ''
    }
});

// Pre-save middleware to ensure experiment numbers are sequential
experimentSchema.pre('save', async function(next) {
    if (!this.number) {
        const lastExperiment = await this.constructor.findOne().sort({ number: -1 });
        this.number = lastExperiment ? lastExperiment.number + 1 : 1;
    }
    next();
});

module.exports = mongoose.model('Experiment', experimentSchema); 