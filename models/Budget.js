// models/Budget.js
const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    name: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 200 },
    
    // Budget Details
    amount: { type: Number, required: true, min: 0 },
    spent: { type: Number, default: 0 }, // This will be updated via aggregation
    remaining: { type: Number, default: 0 },
    percentageUsed: { type: Number, default: 0 },
    
    category: {
        type: String,
        required: true,
        enum: [
            'Housing', 'Transportation', 'Food', 'Utilities', 
            'Insurance', 'Healthcare', 'Entertainment', 'Debt',
            'Education', 'Shopping', 'Personal Care', 'Gifts',
            'Travel', 'Investments', 'Savings', 'Emergency',
            'Taxes', 'Business', 'Other'
        ]
    },
    
    type: {
        type: String,
        enum: ['Fixed', 'Variable', 'Discretionary'],
        required: true
    },
    
    frequency: {
        type: String,
        enum: ['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Annual'],
        required: true,
        default: 'Monthly'
    },
    
    // Period tracking
    period: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        isActive: { type: Boolean, default: true }
    },
    
    // Alert settings
    alerts: {
        enabled: { type: Boolean, default: true },
        threshold: { type: Number, default: 80, min: 0, max: 100 }, // Alert at 80%
        notifiedAt: [{ type: Date }]
    },
    
    // Rollover settings
    rollover: {
        enabled: { type: Boolean, default: false },
        maxRollover: { type: Number }, // Maximum amount to roll over
        unusedExpires: { type: Boolean, default: true }
    },
    
    // Categories can have sub-categories
    subCategories: [{
        name: String,
        amount: Number,
        spent: { type: Number, default: 0 }
    }],
    
    // Tags for organization
    tags: [String],
    
    // Color for UI
    color: { type: String, default: '#4CAF50' },
    icon: String,
    
    // Status
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Compound indexes for common queries
BudgetSchema.index({ userId: 1, 'period.startDate': 1, 'period.endDate': 1 });
BudgetSchema.index({ userId: 1, category: 1, 'period.isActive': 1 });
BudgetSchema.index({ userId: 1, isActive: 1, 'alerts.threshold': 1 });

// Methods
BudgetSchema.methods.calculateProgress = function(expenses) {
    this.spent = expenses
        .filter(e => e.category === this.category)
        .reduce((sum, e) => sum + e.amount, 0);
    
    this.remaining = Math.max(0, this.amount - this.spent);
    this.percentageUsed = (this.spent / this.amount) * 100;
    
    return this;
};

// Static methods
BudgetSchema.statics.findActiveBudgets = function(userId) {
    const now = new Date();
    return this.find({
        userId,
        isActive: true,
        isDeleted: false,
        'period.startDate': { $lte: now },
        'period.endDate': { $gte: now }
    });
};

module.exports = mongoose.model('Budget', BudgetSchema);