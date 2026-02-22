// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    // Transaction type
    type: {
        type: String,
        required: true,
        enum: ['income', 'expense', 'transfer', 'investment', 'debt_payment', 'saving']
    },
    
    // Basic details
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    
    // Categorization
    category: String,
    subCategory: String,
    tags: [String],
    
    // Accounts
    fromAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    toAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    
    // Dates
    date: { type: Date, required: true, index: true },
    valueDate: Date, // For future-dated transactions
    
    // Status
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled', 'recurring'],
        default: 'completed'
    },
    
    // For recurring transactions
    isRecurring: { type: Boolean, default: false },
    recurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringTransaction' },
    
    // For split transactions
    isSplit: { type: Boolean, default: false },
    parentTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    splits: [{
        category: String,
        amount: Number,
        description: String
    }],
    
    // Attachments
    attachments: [{
        filename: String,
        url: String,
        type: String,
        size: Number
    }],
    
    // Location
    location: {
        name: String,
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    
    // Merchant info
    merchant: {
        name: String,
        category: String,
        website: String,
        phone: String
    },
    
    // Tax info
    taxRelevant: { type: Boolean, default: false },
    taxCategory: String,
    taxYear: Number,
    
    // Notes
    notes: String,
    
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date
}, {
    timestamps: true
});

// Indexes
TransactionSchema.index({ userId: 1, date: -1, type: 1 });
TransactionSchema.index({ userId: 1, category: 1, date: -1 });
TransactionSchema.index({ userId: 1, 'merchant.name': 1 });
TransactionSchema.index({ userId: 1, status: 1, date: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);