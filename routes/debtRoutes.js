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


// Debt Management APIs

router.get("/", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.debts);
  } catch (err) {
    console.error("Error fetching debts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name,
      amount,
      interestRate,
      monthlyPayment,
      type,
      term,
      startDate,
      dueDate,
      notes,
    } = req.body;

    const newDebt = {
      name,
      amount: parseFloat(amount),
      remainingBalance: parseFloat(amount),
      interestRate: parseFloat(interestRate),
      monthlyPayment: parseFloat(monthlyPayment),
      type,
      term,
      startDate: new Date(startDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || "",
      paymentHistory: [],
      createdAt: new Date(),
    };

    user.debts.push(newDebt);
    await user.save();

    res.status(201).json({
      message: "Debt added successfully",
      debts: user.debts,
    });
  } catch (err) {
    console.error("Error adding debt:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const debtId = req.params.id;
    const debtIndex = user.debts.findIndex((d) => d._id.toString() === debtId);

    if (debtIndex === -1) {
      return res.status(404).json({ message: "Debt not found" });
    }

    const {
      name,
      amount,
      interestRate,
      monthlyPayment,
      type,
      term,
      startDate,
      dueDate,
      notes,
      isPaidOff,
    } = req.body;

    user.debts[debtIndex] = {
      ...user.debts[debtIndex],
      name: name || user.debts[debtIndex].name,
      amount: amount ? parseFloat(amount) : user.debts[debtIndex].amount,
      interestRate: interestRate
        ? parseFloat(interestRate)
        : user.debts[debtIndex].interestRate,
      monthlyPayment: monthlyPayment
        ? parseFloat(monthlyPayment)
        : user.debts[debtIndex].monthlyPayment,
      type: type || user.debts[debtIndex].type,
      term: term || user.debts[debtIndex].term,
      startDate: startDate
        ? new Date(startDate)
        : user.debts[debtIndex].startDate,
      dueDate: dueDate ? new Date(dueDate) : user.debts[debtIndex].dueDate,
      notes: notes || user.debt[debtIndex].notes,
      isPaidOff:
        isPaidOff !== undefined ? isPaidOff : user.debts[debtIndex].isPaidOff,
    };

    await user.save();

    res.status(200).json({
      message: "Debt updated successfully",
      debts: user.debts,
    });
  } catch (err) {
    console.error("Error updating debt:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const debtId = req.params.id;
    user.debts = user.debts.filter((d) => d._id.toString() !== debtId);

    await user.save();

    res.status(200).json({
      message: "Debt deleted successfully",
      debts: user.debts,
    });
  } catch (err) {
    console.error("Error deleting debt:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/payments", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const debtId = req.params.id;
    const debtIndex = user.debts.findIndex((d) => d._id.toString() === debtId);

    if (debtIndex === -1) {
      return res.status(404).json({ message: "Debt not found" });
    }

    const { amount, date } = req.body;
    const paymentAmount = parseFloat(amount);
    const paymentDate = date ? new Date(date) : new Date();

    // Calculate new remaining balance
    const newBalance = user.debts[debtIndex].remainingBalance - paymentAmount;

    // Add payment to history
    user.debts[debtIndex].paymentHistory.push({
      date: paymentDate,
      amountPaid: paymentAmount,
      remainingBalance: newBalance,
    });

    // Update remaining balance
    user.debts[debtIndex].remainingBalance = newBalance;

    // Mark as paid off if balance is zero
    if (newBalance <= 0) {
      user.debts[debtIndex].isPaidOff = true;
    }

    await user.save();

    res.status(201).json({
      message: "Payment recorded successfully",
      debt: user.debts[debtIndex],
    });
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Debt Calculator API
router.post("/api/debt-calculator", userAuthenticate, async (req, res) => {
  try {
    const { debtAmount, interestRate, monthlyPayment } = req.body;

    // Convert to numbers
    const amount = parseFloat(debtAmount);
    const rate = parseFloat(interestRate) / 100 / 12; // Monthly rate
    const payment = parseFloat(monthlyPayment);

    if (payment <= amount * rate) {
      return res.status(400).json({
        message:
          "Payment is too small to pay off debt with given interest rate",
      });
    }

    // Calculate months to payoff
    const months = Math.ceil(
      -Math.log(1 - (amount * rate) / payment) / Math.log(1 + rate),
    );

    // Calculate total interest
    const totalInterest = payment * months - amount;

    // Calculate payoff date
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);

    // What-if scenarios
    const scenarios = [
      { label: "Current Plan", payment: payment, months },
      {
        label: "+$50/month",
        payment: payment + 50,
        months: Math.ceil(
          -Math.log(1 - (amount * rate) / (payment + 50)) / Math.log(1 + rate),
        ),
      },
      {
        label: "+$100/month",
        payment: payment + 100,
        months: Math.ceil(
          -Math.log(1 - (amount * rate) / (payment + 100)) / Math.log(1 + rate),
        ),
      },
    ];

    res.status(200).json({
      monthsToPayoff: months,
      totalInterest,
      payoffDate: payoffDate.toISOString().split("T")[0],
      scenarios,
    });
  } catch (err) {
    console.error("Error calculating debt payoff:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;