// scripts/migrateUserData.js
const mongoose = require('mongoose');
const NewUserRegistration = require('../models/old/NewUserRegistration');
const User = require('../models/User');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const Goal = require('../models/Goal');
const Debt = require('../models/Debt');
const Investment = require('../models/Investment');
const BillReminder = require('../models/BillReminder');

async function migrateUserData() {
    console.log('Starting data migration...');
    
    try {
        // Get all users from old schema
        const oldUsers = await NewUserRegistration.find({});
        console.log(`Found ${oldUsers.length} users to migrate`);
        
        let migrated = 0;
        let failed = 0;
        
        for (const oldUser of oldUsers) {
            try {
                // Start transaction
                const session = await mongoose.startSession();
                session.startTransaction();
                
                try {
                    // 1. Create new user
                    const newUser = new User({
                        fullname: oldUser.fullname,
                        userName: oldUser.userName,
                        email: oldUser.email,
                        phoneNo: oldUser.phoneNo,
                        gender: oldUser.gender,
                        dateOfBirth: oldUser.dateOfBirth ? new Date(oldUser.dateOfBirth) : null,
                        country: oldUser.country,
                        currency: oldUser.currency || 'USD',
                        password: oldUser.password,
                        emailVerification: {
                            verified: oldUser.emailVerification || false,
                            verifiedAt: oldUser.dateOfEmailValidation ? new Date(oldUser.dateOfEmailValidation) : null
                        },
                        status: oldUser.status || 'active',
                        isBlocked: oldUser.isBlocked || false,
                        createdAt: oldUser.dateOfFormSubmission ? new Date(oldUser.dateOfFormSubmission) : new Date(),
                        settings: {
                            defaultCurrency: oldUser.currency || 'USD',
                            notificationPreferences: {
                                budgetAlerts: true,
                                billReminders: true
                            }
                        }
                    });
                    
                    await newUser.save({ session });
                    
                    // 2. Migrate budgets
                    if (oldUser.budgetCategories && oldUser.budgetCategories.length > 0) {
                        for (const budget of oldUser.budgetCategories) {
                            const newBudget = new Budget({
                                userId: newUser._id,
                                name: budget.name,
                                amount: budget.amount,
                                spent: budget.spent || 0,
                                category: budget.name, // Map to standard categories
                                type: budget.type,
                                frequency: budget.frequency,
                                period: {
                                    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                                    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
                                    isActive: true
                                },
                                alerts: {
                                    enabled: true,
                                    threshold: oldUser.budgetSettings?.alertLevel || 80
                                },
                                createdAt: budget.createdAt || new Date()
                            });
                            
                            await newBudget.save({ session });
                        }
                    }
                    
                    // 3. Migrate expenses
                    if (oldUser.expenses && oldUser.expenses.length > 0) {
                        for (const expense of oldUser.expenses) {
                            const newExpense = new Expense({
                                userId: newUser._id,
                                description: expense.description,
                                amount: expense.amount,
                                category: expense.category,
                                paymentMethod: expense.paymentMethod || 'Cash',
                                date: expense.date || new Date(),
                                createdAt: expense.createdAt || new Date()
                            });
                            
                            await newExpense.save({ session });
                        }
                    }
                    
                    // 4. Migrate debts
                    if (oldUser.debts && oldUser.debts.length > 0) {
                        for (const debt of oldUser.debts) {
                            const newDebt = new Debt({
                                userId: newUser._id,
                                name: debt.name,
                                amount: debt.amount,
                                remainingBalance: debt.remainingBalance,
                                interestRate: debt.interestRate,
                                monthlyPayment: debt.monthlyPayment,
                                type: debt.type,
                                startDate: debt.startDate || new Date(),
                                dueDate: debt.dueDate,
                                isPaidOff: debt.isPaidOff || false,
                                paymentHistory: debt.paymentHistory || [],
                                createdAt: debt.createdAt || new Date()
                            });
                            
                            await newDebt.save({ session });
                        }
                    }
                    
                    // 5. Migrate goals
                    if (oldUser.savingGoals && oldUser.savingGoals.length > 0) {
                        for (const goal of oldUser.savingGoals) {
                            const newGoal = new Goal({
                                userId: newUser._id,
                                name: goal.name,
                                description: goal.description,
                                targetAmount: goal.targetAmount,
                                currentAmount: goal.currentAmount || 0,
                                targetDate: goal.goalDate || new Date(),
                                priority: goal.priority || 'Medium',
                                category: goal.category || 'Other',
                                contributions: goal.contributions || [],
                                createdAt: goal.createdAt || new Date()
                            });
                            
                            newGoal.updateProgress();
                            await newGoal.save({ session });
                        }
                    }
                    
                    // 6. Migrate investments
                    if (oldUser.investments && oldUser.investments.length > 0) {
                        for (const investment of oldUser.investments) {
                            const newInvestment = new Investment({
                                userId: newUser._id,
                                name: investment.name,
                                type: investment.type,
                                currentValue: investment.currentValue,
                                purchasePrice: investment.purchasePrice,
                                purchaseDate: investment.purchaseDate || new Date(),
                                riskLevel: investment.riskLevel,
                                notes: investment.notes,
                                createdAt: investment.createdAt || new Date()
                            });
                            
                            await newInvestment.save({ session });
                        }
                    }
                    
                    // 7. Migrate bill reminders
                    if (oldUser.billReminders && oldUser.billReminders.length > 0) {
                        for (const bill of oldUser.billReminders) {
                            const newBill = new BillReminder({
                                userId: newUser._id,
                                name: bill.name,
                                amount: bill.amount,
                                dueDate: bill.dueDate,
                                category: bill.category || 'Other',
                                frequency: bill.frequency || 'Monthly',
                                status: bill.status || 'pending',
                                isPaid: bill.isPaid || false,
                                paymentHistory: bill.paymentHistory || [],
                                reminderDays: bill.reminderDays || 3,
                                autopay: bill.autopay || false,
                                notes: bill.notes,
                                createdAt: bill.createdAt || new Date()
                            });
                            
                            await newBill.save({ session });
                        }
                    }
                    
                    await session.commitTransaction();
                    migrated++;
                    
                    console.log(`✅ Migrated user: ${oldUser.email} (${migrated}/${oldUsers.length})`);
                    
                } catch (error) {
                    await session.abortTransaction();
                    throw error;
                } finally {
                    session.endSession();
                }
                
            } catch (error) {
                failed++;
                console.error(`❌ Failed to migrate user ${oldUser.email}:`, error.message);
            }
        }
        
        console.log(`
        ========================================
        Migration Complete!
        Total Users: ${oldUsers.length}
        Successfully Migrated: ${migrated}
        Failed: ${failed}
        ========================================
        `);
        
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// Run migration
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        return migrateUserData();
    })
    .then(() => {
        console.log('Migration finished');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration error:', err);
        process.exit(1);
    });