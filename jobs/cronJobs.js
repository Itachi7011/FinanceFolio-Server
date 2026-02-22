// jobs/cronJobs.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const { sendEmail, sendPushNotification } = require('../services/notificationService');

// 1. Daily Bill Reminders (runs every day at 8 AM)
cron.schedule('0 8 * * *', async () => {
    console.log('Running bill reminder check...');
    
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    try {
        const users = await mongoose.model('User').find({
            'settings.notificationPreferences.billReminders': true
        });
        
        for (const user of users) {
            const upcomingBills = await mongoose.model('BillReminder').find({
                userId: user._id,
                dueDate: { $gte: today, $lte: threeDaysFromNow },
                status: 'pending',
                isPaid: false
            });
            
            for (const bill of upcomingBills) {
                const daysUntilDue = Math.ceil((bill.dueDate - today) / (1000 * 60 * 60 * 24));
                
                // Send notification based on user preferences
                if (daysUntilDue <= bill.reminderDays) {
                    await sendNotification(user, 'billReminder', {
                        title: `Bill Reminder: ${bill.name}`,
                        message: `Your ${bill.name} of $${bill.amount} is due in ${daysUntilDue} days.`,
                        billId: bill._id
                    });
                }
            }
        }
    } catch (error) {
        console.error('Bill reminder job failed:', error);
    }
});

// 2. Budget Alert Check (runs every Monday at 9 AM)
cron.schedule('0 9 * * 1', async () => {
    console.log('Running budget alert check...');
    
    try {
        const users = await mongoose.model('User').find({
            'settings.notificationPreferences.budgetAlerts': true
        });
        
        for (const user of users) {
            const budgets = await mongoose.model('Budget').find({
                userId: user._id,
                isActive: true,
                'period.isActive': true,
                'alerts.enabled': true
            });
            
            for (const budget of budgets) {
                // Calculate spent from expenses
                const expenses = await mongoose.model('Expense').aggregate([
                    {
                        $match: {
                            userId: user._id,
                            category: budget.category,
                            date: { $gte: budget.period.startDate, $lte: budget.period.endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ]);
                
                const spent = expenses.length > 0 ? expenses[0].total : 0;
                const percentageUsed = (spent / budget.amount) * 100;
                
                if (percentageUsed >= budget.alerts.threshold) {
                    await sendNotification(user, 'budgetAlert', {
                        title: `Budget Alert: ${budget.name}`,
                        message: `You've used ${percentageUsed.toFixed(1)}% of your ${budget.name} budget.`,
                        budgetId: budget._id
                    });
                }
            }
        }
    } catch (error) {
        console.error('Budget alert job failed:', error);
    }
});

// 3. Goal Progress Tracking (runs monthly on the 1st)
cron.schedule('0 0 1 * *', async () => {
    console.log('Running goal progress tracking...');
    
    try {
        const goals = await mongoose.model('Goal').find({
            isCompleted: false,
            status: { $ne: 'cancelled' }
        });
        
        for (const goal of goals) {
            const oldStatus = goal.status;
            goal.updateProgress();
            
            if (oldStatus !== goal.status) {
                await sendNotification(goal.userId, 'goalUpdate', {
                    title: `Goal Update: ${goal.name}`,
                    message: `Your goal is now ${goal.status.toLowerCase()}.`,
                    goalId: goal._id
                });
            }
            
            await goal.save();
        }
    } catch (error) {
        console.error('Goal tracking job failed:', error);
    }
});

// 4. Insight Generation (runs weekly on Sunday)
cron.schedule('0 2 * * 0', async () => {
    console.log('Generating insights...');
    
    try {
        const users = await mongoose.model('User').find({ status: 'active' });
        const Insight = mongoose.model('Insight');
        
        for (const user of users) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            
            // Generate spending insights
            const spendingInsight = await Insight.generateSpendingInsights(
                user._id, 
                startDate, 
                endDate
            );
            
            if (spendingInsight) {
                await Insight.create({
                    ...spendingInsight,
                    userId: user._id,
                    generatedBy: { type: 'system', timestamp: new Date() }
                });
            }
            
            // Check for saving opportunities
            await checkSavingOpportunities(user._id);
        }
    } catch (error) {
        console.error('Insight generation failed:', error);
    }
});

// 5. Data Backup (runs daily at 3 AM)
cron.schedule('0 3 * * *', async () => {
    console.log('Creating data backup...');
    
    try {
        // Implement backup logic
        const backupService = require('../services/backupService');
        await backupService.createBackup();
    } catch (error) {
        console.error('Backup job failed:', error);
        // Send alert to admins
        await sendAdminAlert('Backup failed', error.message);
    }
});

// Helper function for notifications
async function sendNotification(user, type, data) {
    if (user.settings.notificationPreferences.email) {
        await sendEmail(user.email, type, data);
    }
    
    if (user.settings.notificationPreferences.push) {
        await sendPushNotification(user._id, type, data);
    }
}