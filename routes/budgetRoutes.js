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


// Budget Page

// Add new category
router.post("/categories/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, amount, type, frequency } = req.body;

    // Check if category already exists
    const existingCategory = user.budgetCategories.find(
      (cat) => cat.name === name,
    );
    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    user.budgetCategories.push({
      name,
      amount: parseFloat(amount),
      type,
      frequency,
      spent: 0,
    });

    await user.save();

    res.status(201).json({
      message: "Category added successfully",
      categories: user.budgetCategories,
    });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete category
router.delete(
  "/categories/delete/:name",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const categoryName = req.params.name;

      // Remove category
      user.budgetCategories = user.budgetCategories.filter(
        (cat) => cat.name !== categoryName,
      );

      // Also remove expenses in this category
      user.expenses = user.expenses.filter(
        (exp) => exp.category !== categoryName,
      );

      await user.save();

      res.status(200).json({
        message: "Category deleted successfully",
        categories: user.budgetCategories,
      });
    } catch (err) {
      console.error("Error deleting category:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Update category
router.put(
  "/categories/update/:name",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const categoryName = req.params.name;
      const { name, amount, type, frequency } = req.body;

      const categoryIndex = user.budgetCategories.findIndex(
        (cat) => cat.name === categoryName,
      );

      if (categoryIndex === -1) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Update category
      user.budgetCategories[categoryIndex] = {
        ...user.budgetCategories[categoryIndex],
        name: name || user.budgetCategories[categoryIndex].name,
        amount: amount
          ? parseFloat(amount)
          : user.budgetCategories[categoryIndex].amount,
        type: type || user.budgetCategories[categoryIndex].type,
        frequency: frequency || user.budgetCategories[categoryIndex].frequency,
      };

      // Update expenses if category name changed
      if (name && name !== categoryName) {
        user.expenses = user.expenses.map((exp) => {
          if (exp.category === categoryName) {
            return { ...exp, category: name };
          }
          return exp;
        });
      }

      await user.save();

      res.status(200).json({
        message: "Category updated successfully",
        categories: user.budgetCategories,
      });
    } catch (err) {
      console.error("Error updating category:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Add Expense
router.post("/expenses/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { description, amount, category, date, paymentMethod } = req.body;

    user.expenses.push({
      description,
      amount: parseFloat(amount),
      category,
      date: date || new Date(),
      paymentMethod,
      createdAt: new Date(),
    });

    await user.save();

    res.status(201).json({
      message: "Expense added successfully",
      expenses: user.expenses,
    });
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update Expense
router.put(
  "/expenses/update/:id",
  userAuthenticate,
  async (req, res) => {
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
        amount: amount
          ? parseFloat(amount)
          : user.expenses[expenseIndex].amount,
        category: category || user.expenses[expenseIndex].category,
        date: date || user.expenses[expenseIndex].date,
        paymentMethod:
          paymentMethod || user.expenses[expenseIndex].paymentMethod,
      };

      await user.save();

      res.status(200).json({
        message: "Expense updated successfully",
        expenses: user.expenses,
      });
    } catch (err) {
      console.error("Error updating expense:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Delete Expense
router.delete(
  "/expenses/delete/:id",
  userAuthenticate,
  async (req, res) => {
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
  },
);






module.exports = router;