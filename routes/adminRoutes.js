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


router.get("/api/allUsersList", async (req, res) => {
  try {
    const data = await UsersDB.find();

    res.send(data);
  } catch (err) {
    console.log(err);
  }
});

// Get all users
router.get("/api/allUsersList", async (req, res) => {
  try {
    const data = await UsersDB.find();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Get single user
router.get("/api/users/:id", async (req, res) => {
  try {
    const user = await UsersDB.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// Create user
router.post("/api/users", async (req, res) => {
  try {
    const { fullname, email, userName, password, userType } = req.body;

    // Validate input
    if (!fullname || !email || !userName || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user exists
    const existingUser = await UsersDB.findOne({
      $or: [{ email }, { userName }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email or username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UsersDB({
      fullname,
      email,
      userName,
      password: hashedPassword,
      userType: userType || "User",
      dateOfFormSubmission: new Date(),
    });

    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating user" });
  }
});

// Update user
router.put("/api/users/:id", async (req, res) => {
  try {
    const { fullname, userName, userType } = req.body;
    const updatedUser = await UsersDB.findByIdAndUpdate(
      req.params.id,
      { fullname, userName, userType },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating user" });
  }
});

// Delete user
router.delete("/api/users/:id", async (req, res) => {
  try {
    const deletedUser = await UsersDB.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// Bulk delete users
router.post("/api/users/bulk-delete", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.deleteMany({ _id: { $in: userIds } });
    res.json({ message: "Users deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting users" });
  }
});

// Verify users
router.post("/api/users/verify", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.updateMany(
      { _id: { $in: userIds } },
      { $set: { emailVerification: true } },
    );
    res.json({ message: "Users verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error verifying users" });
  }
});

// Block users
router.post("/api/users/block", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.updateMany(
      { _id: { $in: userIds } },
      { $set: { isBlocked: true } },
    );
    res.json({ message: "Users blocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error blocking users" });
  }
});

// Unblock users
router.post("/api/users/unblock", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.updateMany(
      { _id: { $in: userIds } },
      { $set: { isBlocked: false } },
    );
    res.json({ message: "Users unblocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error unblocking users" });
  }
});



module.exports = router;