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



// Milestones APIs
router.get("/api/milestones", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize milestones array if it doesn't exist
    if (!user.milestones) {
      user.milestones = [];
      await user.save();
    }

    res.status(200).json(user.milestones);
  } catch (err) {
    console.error("Error fetching milestones:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/api/milestones", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      title,
      description,
      targetDate,
      targetAmount,
      category,
      currentAmount,
    } = req.body;

    // Calculate progress
    const progress =
      targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;

    const newMilestone = {
      title,
      description,
      targetDate: new Date(targetDate),
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount || 0),
      category: category || "savings",
      progress,
      createdAt: new Date(),
    };

    // Initialize milestones array if it doesn't exist
    if (!user.milestones) {
      user.milestones = [];
    }

    user.milestones.push(newMilestone);
    await user.save();

    res.status(201).json(newMilestone);
  } catch (err) {
    console.error("Error adding milestone:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/api/milestones/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const milestoneId = req.params.id;
    const {
      title,
      description,
      targetDate,
      targetAmount,
      category,
      currentAmount,
    } = req.body;

    const milestoneIndex = user.milestones.findIndex(
      (m) => m._id.toString() === milestoneId,
    );

    if (milestoneIndex === -1) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    // Calculate new progress
    const newTargetAmount = parseFloat(
      targetAmount || user.milestones[milestoneIndex].targetAmount,
    );
    const newCurrentAmount = parseFloat(
      currentAmount || user.milestones[milestoneIndex].currentAmount,
    );
    const progress =
      newTargetAmount > 0
        ? Math.round((newCurrentAmount / newTargetAmount) * 100)
        : 0;

    // Update milestone
    user.milestones[milestoneIndex] = {
      ...user.milestones[milestoneIndex],
      title: title || user.milestones[milestoneIndex].title,
      description: description || user.milestones[milestoneIndex].description,
      targetDate: targetDate
        ? new Date(targetDate)
        : user.milestones[milestoneIndex].targetDate,
      targetAmount: newTargetAmount,
      currentAmount: newCurrentAmount,
      category: category || user.milestones[milestoneIndex].category,
      progress,
    };

    await user.save();

    res.status(200).json(user.milestones[milestoneIndex]);
  } catch (err) {
    console.error("Error updating milestone:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/api/milestones/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const milestoneId = req.params.id;
    user.milestones = user.milestones.filter(
      (m) => m._id.toString() !== milestoneId,
    );

    await user.save();

    res.status(200).json({ message: "Milestone deleted successfully" });
  } catch (err) {
    console.error("Error deleting milestone:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;