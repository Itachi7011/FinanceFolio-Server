const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const shortid = require("shortid");
const alert = require("electron-alert");
const multer = require("multer");
const bcryptjs = require("bcryptjs");
const cookieParser = require("cookie-parser");
const schedule = require("node-schedule");
const ffmpeg = require('fluent-ffmpeg');
const twilio = require('twilio');
const router = express.Router();



const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;



const twilioClient = twilio(accountSid, authToken);



const UsersDB = require("../models/Users/User");

const userAuthenticate = require("../middleware/userauthenticate");



// Update financial health score
router.post("/api/update-financial-health", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { score } = req.body;

    if (!user.financialData) {
      user.financialData = {};
    }

    user.financialData.healthScore = score;
    await user.save();

    res
      .status(200)
      .json({ message: "Financial health score updated successfully" });
  } catch (err) {
    console.error("Error updating financial health score:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Financial Progress Routes
router.get("/api/financial-health", userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await NewUserRegistration.findById(userId);

    if (!user) {
      return res.status(404).json({
        score: 0,
        message: "User not found",
      });
    }

    // Provide default values if calculations fail
    const savingsRate = calculateSavingsRate(user) || 0;
    const debtRatio = calculateDebtToIncomeRatio(user) || 0;
    const budgetAdherence = calculateBudgetAdherence(user) || 0;
    const diversificationScore = calculateDiversificationScore(user) || 0;
    const emergencyFundStatus = calculateEmergencyFundStatus(user) || 0;

    const score = Math.round(
      savingsRate * 20 +
        debtRatio * 20 +
        budgetAdherence * 20 +
        diversificationScore * 20 +
        emergencyFundStatus * 20,
    );

    res.status(200).json({
      score: Math.min(score, 100),
      savingsRate,
      debtToIncomeRatio: debtRatio,
      budgetAdherenceScore: budgetAdherence,
      diversificationScore,
      emergencyFundMonths: emergencyFundStatus * 6, // Convert to months
    });
  } catch (error) {
    console.error("Financial health error:", error);
    res.status(200).json({
      score: 0,
      message: "Using default values due to calculation error",
    });
  }
});

router.get("/api/financial-metrics", userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await NewUserRegistration.findById(userId);

    if (!user) {
      return res.status(200).json({
        netWorth: 0,
        savingsRate: 0,
        debtToIncome: 0,
        emergencyFundMonths: 0,
        message: "User not found, using default values",
      });
    }

    // Provide default values if calculations fail
    const netWorth = calculateNetWorth(user) || 0;
    const savingsRate = calculateSavingsRate(user) || 0;
    const debtToIncome = calculateDebtToIncomeRatio(user) || 0;
    const emergencyFundMonths = calculateEmergencyFundMonths(user) || 0;

    res.status(200).json({
      netWorth,
      savingsRate,
      debtToIncome,
      emergencyFundMonths,
    });
  } catch (error) {
    console.error("Financial metrics error:", error);
    res.status(200).json({
      netWorth: 0,
      savingsRate: 0,
      debtToIncome: 0,
      emergencyFundMonths: 0,
      message: "Using default values due to calculation error",
    });
  }
});

// Financial Data API
router.get("/api/financial-data", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize financialData if it doesn't exist
    if (!user.financialData) {
      user.financialData = {
        netWorth: 0,
        savingsRate: 0,
        debtToIncomeRatio: 0,
        emergencyFundMonths: 0,
        diversificationScore: 0,
        budgetAdherenceScore: 0,
      };
      await user.save();
    }

    res.status(200).json(user.financialData);
  } catch (err) {
    console.error("Error fetching financial data:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Insights API
router.get("/api/insights", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize insights array if it doesn't exist
    if (!user.insights) {
      user.insights = [];
      await user.save();
    }

    res.status(200).json(user.insights);
  } catch (err) {
    console.error("Error fetching insights:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Projections API
router.get("/api/projections", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize projections if it doesn't exist
    if (!user.projections) {
      user.projections = {
        conservative: [],
        moderate: [],
        aggressive: [],
      };
      await user.save();
    }

    res.status(200).json(user.projections);
  } catch (err) {
    console.error("Error fetching projections:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;