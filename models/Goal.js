// models/Goal.js
const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    // Basic Info
    name: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500 },
    
    // Goal Type & Category
    category: {
        type: String,
        required: true,
        enum: [
            'Emergency Fund', 'Retirement', 'Education', 'Housing',
            'Vacation', 'Vehicle', 'Wedding', 'Baby', 'Business',
            'Investment', 'Debt Payoff', 'Major Purchase', 'Healthcare',
            'Charity', 'Legacy', 'Freedom', 'Other'
        ]
    },
    
    // Financial Targets
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, required: true, default: 0, min: 0 },
    initialAmount: { type: Number, default: 0 },
    
    // Timeline
    startDate: { type: Date, required: true, default: Date.now },
    targetDate: { type: Date, required: true },
    completedDate: Date,
    
    // Priority & Status
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Not Started', 'In Progress', 'On Track', 'Behind', 'Completed', 'Cancelled'],
        default: 'Not Started'
    },
    
    // Contribution Plan
    contribution: {
        amount: { type: Number, default: 0 },
        frequency: {
            type: String,
            enum: ['One-time', 'Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Annual']
        },
        dayOfMonth: Number,
        dayOfWeek: String,
        autoTransfer: { type: Boolean, default: false },
        sourceAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }
    },
    
    // Progress Tracking
    progress: { type: Number, default: 0, min: 0, max: 100 },
    milestones: [{
        name: String,
        target: Number,
        achieved: { type: Boolean, default: false },
        achievedDate: Date,
        reward: String
    }],
    
    // Contributions History
    contributions: [{
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        note: String,
        source: {
            type: String,
            enum: ['Manual', 'Transfer', 'Round-up', 'Bonus', 'Gift', 'Interest']
        },
        transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
    }],
    
    // Visual representation
    icon: String,
    color: { type: String, default: '#4CAF50' },
    coverImage: String,
    
    // Motivation & Gamification
    visionBoard: [{
        title: String,
        imageUrl: String,
        description: String
    }],
    affirmations: [String],
    reasons: [String],
    
    // Sharing & Collaboration
    isShared: { type: Boolean, default: false },
    sharedWith: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        permission: { type: String, enum: ['view', 'contribute'], default: 'view' },
        email: String
    }],
    
    // Reminders & Notifications
    reminders: [{
        type: { type: String, enum: ['email', 'push', 'sms'] },
        daysBefore: Number,
        message: String,
        sent: [{ type: Date }]
    }],
    
    // Metadata
    tags: [String],
    notes: String,
    
    // Completion & Archive
    isCompleted: { type: Boolean, default: false, index: true },
    completionMessage: String,
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
    
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date
}, {
    timestamps: true
});

// Indexes
GoalSchema.index({ userId: 1, status: 1, targetDate: 1 });
GoalSchema.index({ userId: 1, priority: 1, currentAmount: -1 });
GoalSchema.index({ userId: 1, isShared: 1, 'sharedWith.userId': 1 });

// Virtuals
GoalSchema.virtual('remainingAmount').get(function() {
    return Math.max(0, this.targetAmount - this.currentAmount);
});

GoalSchema.virtual('daysRemaining').get(function() {
    if (this.isCompleted) return 0;
    const now = new Date();
    const target = new Date(this.targetDate);
    const diffTime = target - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

GoalSchema.virtual('requiredMonthly').get(function() {
    const remaining = this.targetAmount - this.currentAmount;
    const monthsRemaining = this.daysRemaining / 30;
    return monthsRemaining > 0 ? remaining / monthsRemaining : 0;
});

// Methods
GoalSchema.methods.updateProgress = function() {
    this.progress = (this.currentAmount / this.targetAmount) * 100;
    
    // Update status based on timeline
    if (this.progress >= 100) {
        this.status = 'Completed';
        this.isCompleted = true;
        this.completedDate = new Date();
    } else {
        const daysRemaining = this.daysRemaining;
        const progressNeeded = 100 - this.progress;
        const daysTotal = (new Date(this.targetDate) - new Date(this.startDate)) / (1000 * 60 * 60 * 24);
        const expectedProgress = ((daysTotal - daysRemaining) / daysTotal) * 100;
        
        if (this.progress >= expectedProgress * 0.9) {
            this.status = 'On Track';
        } else if (this.progress >= expectedProgress * 0.7) {
            this.status = 'In Progress';
        } else {
            this.status = 'Behind';
        }
    }
    
    return this;
};

GoalSchema.methods.addContribution = async function(amount, source = 'Manual', note = '') {
    this.currentAmount += amount;
    this.contributions.push({
        amount,
        source,
        note,
        date: new Date()
    });
    
    this.updateProgress();
    return this.save();
};

// Pre-save middleware
GoalSchema.pre('save', function(next) {
    if (this.isModified('currentAmount') || this.isModified('targetAmount')) {
        this.updateProgress();
    }
    next();
});

module.exports = mongoose.model('Goal', GoalSchema);