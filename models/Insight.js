// models/Insight.js
const mongoose = require('mongoose');

const InsightSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    // Insight Type
    type: {
        type: String,
        required: true,
        enum: [
            'spending_pattern', 'budget_alert', 'saving_opportunity',
            'investment_recommendation', 'debt_strategy', 'tax_tip',
            'cash_flow', 'net_worth_trend', 'goal_milestone',
            'anomaly_detection', 'prediction', 'recommendation',
            'behavior_insight', 'financial_health_score'
        ]
    },
    
    // Insight Content
    title: { type: String, required: true },
    description: { type: String, required: true },
    summary: String,
    
    // Severity/Importance
    importance: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    
    // Confidence Score (for ML-based insights)
    confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 70
    },
    
    // Data backing this insight
    data: {
        metrics: mongoose.Schema.Types.Mixed,
        comparisons: [{
            label: String,
            value: Number,
            change: Number,
            benchmark: Number
        }],
        trends: [{
            date: Date,
            value: Number
        }],
        anomalies: [{
            date: Date,
            expected: Number,
            actual: Number,
            deviation: Number
        }]
    },
    
    // Related entities
    relatedTo: {
        budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget' },
        expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
        goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
        debtId: { type: mongoose.Schema.Types.ObjectId, ref: 'Debt' },
        investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment' }
    },
    
    // Actionable recommendations
    actions: [{
        type: {
            type: String,
            enum: ['adjust_budget', 'reduce_expense', 'increase_saving',
                   'pay_debt', 'rebalance', 'review', 'create_goal']
        },
        title: String,
        description: String,
        impact: {
            amount: Number,
            timeframe: String,
            confidence: Number
        },
        isCompleted: { type: Boolean, default: false },
        completedAt: Date
    }],
    
    // Time relevance
    validFrom: { type: Date, default: Date.now },
    validUntil: Date,
    isExpired: { type: Boolean, default: false },
    
    // User interaction
    isRead: { type: Boolean, default: false },
    readAt: Date,
    isDismissed: { type: Boolean, default: false },
    dismissedAt: Date,
    isSaved: { type: Boolean, default: false },
    userRating: {
        helpful: { type: Boolean },
        rating: { type: Number, min: 1, max: 5 },
        feedback: String
    },
    
    // Generation metadata
    generatedBy: {
        type: { type: String, enum: ['system', 'ai', 'manual', 'rule'] },
        version: String,
        timestamp: Date
    },
    
    // Categories for filtering
    categories: [String],
    tags: [String],
    
    // Status
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Indexes for performance
InsightSchema.index({ userId: 1, type: 1, importance: 1 });
InsightSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
InsightSchema.index({ userId: 1, validUntil: 1, isExpired: 1 });
InsightSchema.index({ 'relatedTo.budgetId': 1 });
InsightSchema.index({ 'relatedTo.goalId': 1 });

// Static methods for generating insights
InsightSchema.statics.generateSpendingInsights = async function(userId, startDate, endDate) {
    const expenses = await mongoose.model('Expense').aggregate([
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
                avgAmount: { $avg: '$amount' },
                maxAmount: { $max: '$amount' },
                minAmount: { $min: '$amount' }
            }
        },
        { $sort: { total: -1 } }
    ]);
    
    // Find top spending category
    if (expenses.length > 0) {
        const topCategory = expenses[0];
        
        return {
            type: 'spending_pattern',
            title: `Your top spending category is ${topCategory._id}`,
            description: `You spent $${topCategory.total.toFixed(2)} on ${topCategory._id}, which is ${topCategory.count} transactions.`,
            importance: 'medium',
            data: { topCategory, allCategories: expenses }
        };
    }
    
    return null;
};

// Method to mark as read
InsightSchema.methods.markAsRead = function() {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

// Method to dismiss
InsightSchema.methods.dismiss = function() {
    this.isDismissed = true;
    this.dismissedAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Insight', InsightSchema);