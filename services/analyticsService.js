// services/analyticsService.js
class AnalyticsService {
    constructor(userId) {
        this.userId = userId;
        this.Expense = mongoose.model('Expense');
        this.Goal = mongoose.model('Goal');
        this.Budget = mongoose.model('Budget');
    }

    // 1. Cash Flow Analysis
    async getCashFlowAnalysis(startDate, endDate) {
        const pipeline = [
            {
                $match: {
                    userId: this.userId,
                    date: { $gte: startDate, $lte: endDate },
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        day: { $dayOfMonth: '$date' }
                    },
                    totalIncome: {
                        $sum: {
                            $cond: [{ $gte: ['$amount', 0] }, '$amount', 0]
                        }
                    },
                    totalExpenses: {
                        $sum: {
                            $cond: [{ $lt: ['$amount', 0] }, '$amount', 0]
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ];

        const dailyFlow = await this.Expense.aggregate(pipeline);
        
        // Calculate trends
        let totalIncome = 0, totalExpenses = 0;
        dailyFlow.forEach(day => {
            totalIncome += day.totalIncome;
            totalExpenses += Math.abs(day.totalExpenses);
        });

        return {
            daily: dailyFlow,
            summary: {
                totalIncome,
                totalExpenses,
                netCashFlow: totalIncome - totalExpenses,
                savingsRate: totalIncome > 0 
                    ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(2)
                    : 0
            }
        };
    }

    // 2. Category Breakdown
    async getCategoryBreakdown(startDate, endDate) {
        return await this.Expense.aggregate([
            {
                $match: {
                    userId: this.userId,
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
            {
                $addFields: {
                    percentage: {
                        $multiply: [
                            { $divide: ['$total', { $sum: '$total' }] },
                            100
                        ]
                    }
                }
            },
            { $sort: { total: -1 } }
        ]);
    }

    // 3. Net Worth Calculation
    async calculateNetWorth() {
        const Account = mongoose.model('Account');
        const Debt = mongoose.model('Debt');
        
        // Get all assets
        const assets = await Account.find({
            userId: this.userId,
            isActive: true,
            includeInNetWorth: true,
            type: { $in: ['checking', 'savings', 'investment', 'cash'] }
        });
        
        const totalAssets = assets.reduce((sum, acc) => sum + acc.currentBalance, 0);
        
        // Get all liabilities
        const debts = await Debt.find({
            userId: this.userId,
            isPaidOff: false
        });
        
        const totalLiabilities = debts.reduce((sum, debt) => sum + debt.remainingBalance, 0);
        
        // Historical data for trend
        const historical = await this.getNetWorthHistory();
        
        return {
            current: {
                assets: totalAssets,
                liabilities: totalLiabilities,
                netWorth: totalAssets - totalLiabilities
            },
            historical,
            assetsByType: this.groupAssetsByType(assets),
            liabilitiesByType: this.groupLiabilitiesByType(debts)
        };
    }

    // 4. Financial Health Score
    async calculateHealthScore() {
        const scores = {
            savings: await this.calculateSavingsScore(),
            debt: await this.calculateDebtScore(),
            budget: await this.calculateBudgetScore(),
            investment: await this.calculateInvestmentScore(),
            emergency: await this.calculateEmergencyFundScore()
        };
        
        const weights = {
            savings: 0.25,
            debt: 0.30,
            budget: 0.20,
            investment: 0.15,
            emergency: 0.10
        };
        
        let totalScore = 0;
        let recommendations = [];
        
        for (const [key, value] of Object.entries(scores)) {
            totalScore += value * weights[key];
            
            if (value < 50) {
                recommendations.push(this.getRecommendation(key, 'low'));
            } else if (value < 70) {
                recommendations.push(this.getRecommendation(key, 'medium'));
            }
        }
        
        return {
            overall: Math.round(totalScore),
            components: scores,
            recommendations,
            grade: this.getGrade(totalScore)
        };
    }

    // 5. Export Reports
    async generateReport(type, format, dateRange) {
        let data;
        
        switch(type) {
            case 'monthly-summary':
                data = await this.getMonthlySummary(dateRange);
                break;
            case 'tax-report':
                data = await this.getTaxReport(dateRange);
                break;
            case 'investment-performance':
                data = await this.getInvestmentPerformance(dateRange);
                break;
            default:
                throw new Error('Invalid report type');
        }
        
        // Convert to requested format
        if (format === 'pdf') {
            return await this.generatePDF(data, type);
        } else if (format === 'csv') {
            return await this.generateCSV(data);
        } else if (format === 'excel') {
            return await this.generateExcel(data);
        }
        
        return data;
    }

    // Private helper methods
    async getNetWorthHistory() {
        return await this.Expense.aggregate([
            {
                $match: {
                    userId: this.userId,
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    netChange: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
    }

    getGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }
}

module.exports = AnalyticsService;