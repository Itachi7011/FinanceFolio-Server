// models/Expense.js
const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    // Core fields
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    
    // Categorization
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
    subCategory: String,
    
    // Payment details
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 
               'PayPal', 'Venmo', 'Cryptocurrency', 'Check', 'Other'],
        required: true
    },
    paymentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    
    // Date & Time
    date: { type: Date, required: true, index: true },
    time: String,
    
    // Location
    location: {
        name: String,
        address: String,
        city: String,
        state: String,
        country: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    
    // Recurring expenses
    isRecurring: { type: Boolean, default: false },
    recurringPattern: {
        frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
        interval: { type: Number, default: 1 },
        endDate: Date,
        occurrences: Number
    },
    parentRecurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
    
    // Split expenses (for group payments)
    isSplit: { type: Boolean, default: false },
    splitWith: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: Number,
        settled: { type: Boolean, default: false }
    }],
    
    // Attachments
    attachments: [{
        filename: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number,
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    // Notes & Tags
    notes: String,
    tags: [String],
    
    // Tax related
    isTaxDeductible: { type: Boolean, default: false },
    taxCategory: String,
    
    // Budget linkage
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget' },
    
    // Status
    status: {
        type: String,
        enum: ['pending', 'cleared', 'reconciled', 'disputed', 'cancelled'],
        default: 'cleared'
    },
    isDeleted: { type: Boolean, default: false, index: true },
    
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Compound indexes for reporting
ExpenseSchema.index({ userId: 1, date: -1, category: 1 });
ExpenseSchema.index({ userId: 1, 'paymentMethod': 1, date: -1 });
ExpenseSchema.index({ userId: 1, isTaxDeductible: 1, date: -1 });
ExpenseSchema.index({ userId: 1, tags: 1 });

// Virtual for budget
ExpenseSchema.virtual('budget', {
    ref: 'Budget',
    localField: 'budgetId',
    foreignField: '_id',
    justOne: true
});

// Methods
ExpenseSchema.methods.toJSON = function() {
    const expense = this.toObject();
    delete expense.isDeleted;
    delete expense.deletedAt;
    delete expense.deletedBy;
    return expense;
};

// Static methods for analytics
ExpenseSchema.statics.getMonthlyTotals = function(userId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return this.aggregate([
        {
            $match: {
                userId: mongoose.Types.ObjectId(userId),
                date: { $gte: startDate, $lte: endDate },
                isDeleted: false
            }
        },
        {
            $group: {
                _id: '$category',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        },
        { $sort: { total: -1 } }
    ]);
};

module.exports = mongoose.model('Expense', ExpenseSchema);