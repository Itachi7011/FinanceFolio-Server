const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const shortid = require("shortid");
const alert = require("electron-alert");
const multer = require("multer");
const bcryptjs = require("bcryptjs");
const cookieParser = require("cookie-parser");
const schedule = require("node-schedule");
const ffmpeg = require("fluent-ffmpeg");
const twilio = require("twilio");
const router = express.Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const twilioClient = twilio(accountSid, authToken);

const UsersDB = require("../models/Users/User");

const userAuthenticate = require("../middleware/userauthenticate");



// Expense Prediction APIs

router.post("/api/expense-predictions/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { category, amount, percentage, isFixed } = req.body;

    user.expensePredictions.push({
      category,
      amount: parseFloat(amount),
      percentage: percentage || 0,
      isFixed: isFixed || false,
      createdAt: new Date(),
    });

    await user.save();

    res.status(201).json({
      message: "Expense prediction added successfully",
      predictions: user.expensePredictions,
    });
  } catch (err) {
    console.error("Error adding expense prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/api/expense-predictions/update/:id",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const predictionId = req.params.id;
      const { category, amount, percentage, isFixed } = req.body;

      const predictionIndex = user.expensePredictions.findIndex(
        (pred) => pred._id.toString() === predictionId,
      );

      if (predictionIndex === -1) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      user.expensePredictions[predictionIndex] = {
        ...user.expensePredictions[predictionIndex],
        category: category || user.expensePredictions[predictionIndex].category,
        amount: amount
          ? parseFloat(amount)
          : user.expensePredictions[predictionIndex].amount,
        percentage:
          percentage || user.expensePredictions[predictionIndex].percentage,
        isFixed:
          isFixed !== undefined
            ? isFixed
            : user.expensePredictions[predictionIndex].isFixed,
      };

      await user.save();

      res.status(200).json({
        message: "Expense prediction updated successfully",
        predictions: user.expensePredictions,
      });
    } catch (err) {
      console.error("Error updating expense prediction:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/api/expense-predictions/delete/:id",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const predictionId = req.params.id;

      user.expensePredictions = user.expensePredictions.filter(
        (pred) => pred._id.toString() !== predictionId,
      );

      await user.save();

      res.status(200).json({
        message: "Expense prediction deleted successfully",
        predictions: user.expensePredictions,
      });
    } catch (err) {
      console.error("Error deleting expense prediction:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);


// Expense CRUD operations
router.post("/api/expenses", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { description, amount, category, date, paymentMethod } = req.body;

    user.expenses.push({
      description,
      amount: parseFloat(amount),
      category,
      date: date || new Date(),
      paymentMethod: paymentMethod || "Credit Card",
    });

    await user.save();

    res.status(201).json({
      message: "Expense added successfully",
      expense: user.expenses[user.expenses.length - 1],
    });
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/api/expenses/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenseId = req.params.id;
    const { description, amount, category, date, paymentMethod } = req.body;

    const expenseIndex = user.expenses.findIndex(
      (exp) => exp._id.toString() === expenseId,
    );

    if (expenseIndex === -1) {
      return res.status(404).json({ message: "Expense not found" });
    }

    user.expenses[expenseIndex] = {
      ...user.expenses[expenseIndex],
      description: description || user.expenses[expenseIndex].description,
      amount: amount ? parseFloat(amount) : user.expenses[expenseIndex].amount,
      category: category || user.expenses[expenseIndex].category,
      date: date ? new Date(date) : user.expenses[expenseIndex].date,
      paymentMethod: paymentMethod || user.expenses[expenseIndex].paymentMethod,
    };

    await user.save();

    res.status(200).json({
      message: "Expense updated successfully",
      expense: user.expenses[expenseIndex],
    });
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/api/expenses/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenseId = req.params.id;

    user.expenses = user.expenses.filter(
      (exp) => exp._id.toString() !== expenseId,
    );

    await user.save();

    res.status(200).json({
      message: "Expense deleted successfully",
      expenses: user.expenses,
    });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;
