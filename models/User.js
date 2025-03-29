const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { buffer } = require("stream/consumers");

const NewUserRegistrationSchema = new mongoose.Schema({
    fullname: {
        type: String,
        // ,
        // require : true
    },
    userName: {
        type: String,
        // ,
        // require : true
    },
    email: {
        type: String,
        // ,
        // require : true
    },

    phoneNo: {
        type: String,
        // ,
        // require : true
    },
    gender: {
        type: String,
    },
    age: {
        type: String,
    },
    userType: {
        type: String,
    },
    country: {
        type: String,
    },
    currency: {
        type: String,
    },
    dateOfBirth: {
        type: String,
    },
    bio: {
        type: String,
    },
    dateOfFormSubmission: {
        type: String,
    },
    convertedDateOfFormSubmission: {
        type: String,
    },
    dateOfEmailValidation: {
        type: String,
    },
    emailVerification: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: Number,
    },

    budgetCategories: {
        type: [{
            name: { type: String, required: true },          // e.g., "Groceries"
            amount: { type: Number, required: true },        // e.g., 500
            type: {
                type: String,
                enum: ["Fixed", "Variable", "Discretionary"],
                required: true
            },
            frequency: {
                type: String,
                enum: ["Monthly", "Weekly", "Annual"],
                required: true
            },
            spent: { type: Number, default: 0 },             // Auto-calculated
            createdAt: { type: Date, default: Date.now }
        }],
        default: []
    },

    expenses: {
        type: [{
            description: { type: String, required: true },    // e.g., "Weekly Shopping"
            amount: { type: Number, required: true },         // e.g., 120
            category: { type: String, required: true },       // Matches budgetCategories.name
            date: { type: Date, required: true },             // e.g., "2025-03-15"
            paymentMethod: {
                type: String,
                enum: ["Credit Card", "Cash", "Bank Transfer"],
                required: true
            },
            createdAt: { type: Date, default: Date.now }
        }],
        default: []
    },

    budgetSettings: {
        alertLevel: { type: Number, default: 80 },            // % threshold for warnings
        defaultCurrency: { type: String, default: "USD" },    // e.g., "USD", "EUR"
        monthlyBudget: { type: Number, default: 0 }          // Optional total budget
    },

    debts: {
        type: [{
            name: { type: String, required: true },               // e.g., "Credit Card"
            amount: { type: Number, required: true },             // Original debt amount
            remainingBalance: { type: Number, required: true },   // Current owed amount
            interestRate: { type: Number, required: true },       // APR (e.g., 15.99)
            monthlyPayment: { type: Number, required: true },     // Minimum payment
            type: {
                type: String,
                enum: ["Credit Card", "Student Loan", "Mortgage", "Auto Loan", "Personal Loan"],
                required: true
            },
            term: { type: String },                              // e.g., "36 months"
            startDate: { type: Date, required: true },            // When debt was taken
            dueDate: { type: Date },                              // Final payment date
            isPaidOff: { type: Boolean, default: false },
            paymentHistory: [{
                date: { type: Date, default: Date.now },
                amountPaid: { type: Number, required: true },
                remainingBalance: { type: Number, required: true }
            }],
            createdAt: { type: Date, default: Date.now }
        }],
        default: []
    },
    debtSettings: {
        repaymentStrategy: {
            type: String,
            enum: ["Snowball", "Avalanche", "Hybrid"],
            default: "Snowball"
        },
        emergencyFund: { type: Number, default: 0 }             // Savings for debt emergencies
    },

    // 3. Investment Portfolio (new)
    investments: {
        type: [{
            name: { type: String, required: true },              // e.g., "Apple Inc."
            type: {
                type: String,
                enum: ["Stock", "Bond", "ETF", "Real Estate", "Cryptocurrency"],
                required: true
            },
            currentValue: { type: Number, required: true },      // Current market value
            purchasePrice: { type: Number, required: true },     // Initial investment
            roi: { type: Number },                               // Return on investment (%)
            percentageOfPortfolio: { type: Number },             // e.g., 30 (% of total)
            targetAllocation: { type: Number },                  // Ideal % in portfolio
            purchaseDate: { type: Date, required: true },
            riskLevel: { type: String, enum: ["Low", "Medium", "High"] },
            notes: { type: String },                             // User comments
            createdAt: { type: Date, default: Date.now }
        }],
        default: []
    },
    investmentSettings: {
        riskTolerance: {
            type: String,
            enum: ["Conservative", "Moderate", "Aggressive"],
            default: "Moderate"
        },
        targetAnnualReturn: { type: Number, default: 7 }       // e.g., 7%
    },

    // 4. Income & Expense Predictions (new)
    incomePredictions: {
        type: [{
            month: { type: String, required: true },            // e.g., "March 2025"
            source: {
                type: String,
                enum: ["Salary", "Freelance", "Dividends", "Rental", "Side Hustle"],
                required: true
            },
            amount: { type: Number, required: true },           // Predicted amount
            isRecurring: { type: Boolean, default: true },
            confidenceScore: { type: Number, default: 80 }      // Prediction accuracy (0-100)
        }],
        default: []
    },
    expensePredictions: {
        type: [{
            category: {
                type: String,
                enum: ["Rent", "Groceries", "Transportation", "Utilities", "Entertainment"],
                required: true
            },
            amount: { type: Number, required: true },           // Predicted amount
            percentage: { type: Number },                       // % of total expenses
            isFixed: { type: Boolean, default: false }          // Fixed or variable expense
        }],
        default: []
    },
    predictionSettings: {
        forecastRange: {
            type: String,
            enum: ["1 Month", "3 Months", "6 Months", "1 Year"],
            default: "3 Months"
        },
        adjustForInflation: { type: Boolean, default: true }
    },

    status: {
        type: String,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    blockedBy: {
        type: String
    },
    password: {
        type: String,
        // ,
        // require : true
    },
    cpassword: {
        type: String,
        require: true,
    },
    tokens: {
        type: String,
    },
});

NewUserRegistrationSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

NewUserRegistrationSchema.methods.generateAuthToken = async function () {
    try {
        let token1 = jwt.sign({ _id: this._id }, process.env.SECRET_KEY, {
            expiresIn: "2592000000",
        });
        this.tokens = token1;
        await this.save();
        return token1;
    } catch (err) {
        console.log(err);
    }
};

const NewUserRegistration = new mongoose.model(
    "Finance_User",
    NewUserRegistrationSchema
);
module.exports = NewUserRegistration;
