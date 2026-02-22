// models/Account.js
const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    // Account details
    name: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: [
            'checking', 'savings', 'credit_card', 'investment',
            'loan', 'mortgage', 'cash', 'other'
        ]
    },
    
    // Financial institutions
    bankName: String,
    accountNumber: { type: String, encrypted: true }, // Encrypted
    routingNumber: { type: String, encrypted: true },
    
    // Balance
    currentBalance: { type: Number, required: true, default: 0 },
    availableBalance: Number,
    currency: { type: String, default: 'USD' },
    
    // Credit specific
    creditLimit: Number,
    apr: Number,
    dueDate: Date,
    minimumPayment: Number,
    
    // Investment specific
    investmentType: String,
    riskLevel: String,
    
    // Connection details (for bank sync)
    connection: {
        provider: String,
        externalId: String,
        lastSync: Date,
        syncStatus: String,
        credentials: { type: mongoose.Schema.Types.Mixed, encrypted: true }
    },
    
    // Account status
    isActive: { type: Boolean, default: true },
    isClosed: { type: Boolean, default: false },
    closedDate: Date,
    
    // Preferences
    includeInNetWorth: { type: Boolean, default: true },
    includeInBudget: { type: Boolean, default: true },
    color: String,
    icon: String,
    
    // Metadata
    notes: String,
    tags: [String],
    
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Indexes
AccountSchema.index({ userId: 1, type: 1, isActive: 1 });
AccountSchema.index({ 'connection.provider': 1, 'connection.externalId': 1 });

module.exports = mongoose.model('Account', AccountSchema);