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



// Tax Tips API Routes
router.get("/tax-tips", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxTips);
  } catch (err) {
    console.error("Error fetching tax tips:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/tax-tips", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { title, content, category } = req.body;

    user.taxTips.push({
      title,
      content,
      category: category || "individual",
    });

    await user.save();

    res.status(201).json({
      message: "Tax tip added successfully",
      tip: user.taxTips[user.taxTips.length - 1],
    });
  } catch (err) {
    console.error("Error adding tax tip:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/tax-tips/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const tipId = req.params.id;
    const { title, content, category } = req.body;

    const tipIndex = user.taxTips.findIndex(
      (tip) => tip._id.toString() === tipId,
    );
    if (tipIndex === -1)
      return res.status(404).json({ message: "Tax tip not found" });

    user.taxTips[tipIndex] = {
      ...user.taxTips[tipIndex],
      title: title || user.taxTips[tipIndex].title,
      content: content || user.taxTips[tipIndex].content,
      category: category || user.taxTips[tipIndex].category,
    };

    await user.save();

    res.status(200).json({
      message: "Tax tip updated successfully",
      tip: user.taxTips[tipIndex],
    });
  } catch (err) {
    console.error("Error updating tax tip:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/tax-tips/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const tipId = req.params.id;
    user.taxTips = user.taxTips.filter((tip) => tip._id.toString() !== tipId);

    await user.save();

    res.status(200).json({
      message: "Tax tip deleted successfully",
      tips: user.taxTips,
    });
  } catch (err) {
    console.error("Error deleting tax tip:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Tax Deductions API Routes (similar structure as above)
router.get("/tax-deductions", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxDeductions);
  } catch (err) {
    console.error("Error fetching tax deductions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/tax-deductions", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, description, eligibility, maxAmount } = req.body;

    user.taxDeductions.push({
      name,
      description,
      eligibility,
      maxAmount,
    });

    await user.save();

    res.status(201).json({
      message: "Tax deduction added successfully",
      deduction: user.taxDeductions[user.taxDeductions.length - 1],
    });
  } catch (err) {
    console.error("Error adding tax deduction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add similar PUT and DELETE endpoints for tax deductions

// Tax Predictions API Routes (similar structure)
router.get("/tax-predictions", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxPredictions);
  } catch (err) {
    console.error("Error fetching tax predictions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/tax-predictions", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { year, title, content, impact } = req.body;

    user.taxPredictions.push({
      year,
      title,
      content,
      impact: impact || "low",
    });

    await user.save();

    res.status(201).json({
      message: "Tax prediction added successfully",
      prediction: user.taxPredictions[user.taxPredictions.length - 1],
    });
  } catch (err) {
    console.error("Error adding tax prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add similar PUT and DELETE endpoints for tax predictions

// Tax FAQs API Routes (similar structure)
router.get("/tax-faqs", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxFaqs);
  } catch (err) {
    console.error("Error fetching tax FAQs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/tax-faqs", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { question, answer, category } = req.body;

    user.taxFaqs.push({
      question,
      answer,
      category: category || "general",
    });

    await user.save();

    res.status(201).json({
      message: "Tax FAQ added successfully",
      faq: user.taxFaqs[user.taxFaqs.length - 1],
    });
  } catch (err) {
    console.error("Error adding tax FAQ:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;