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


// Investments API Routes

router.get("/", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.investments);
  } catch (err) {
    console.error("Error fetching investments:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Calculate ROI if not provided
    let roi = req.body.roi;
    if (!roi && req.body.currentValue && req.body.purchasePrice) {
      roi =
        ((req.body.currentValue - req.body.purchasePrice) /
          req.body.purchasePrice) *
        100;
    }

    const newInvestment = {
      name: req.body.name,
      type: req.body.type,
      currentValue: req.body.currentValue,
      purchasePrice: req.body.purchasePrice,
      purchaseDate: req.body.purchaseDate || new Date(),
      roi: roi || 0,
      percentageOfPortfolio: req.body.percentageOfPortfolio || 0,
      targetAllocation: req.body.targetAllocation || 0,
      riskLevel: req.body.riskLevel || "Medium",
      notes: req.body.notes || "",
      createdAt: new Date(),
    };

    user.investments.push(newInvestment);
    await user.save();

    res.status(201).json(newInvestment);
  } catch (err) {
    console.error("Error adding investment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const investmentId = req.params.id;
    const investmentIndex = user.investments.findIndex(
      (inv) => inv._id.toString() === investmentId,
    );

    if (investmentIndex === -1) {
      return res.status(404).json({ message: "Investment not found" });
    }

    // Calculate ROI if currentValue or purchasePrice changed
    let roi = req.body.roi;
    if ((req.body.currentValue || req.body.purchasePrice) && !roi) {
      const currentValue =
        req.body.currentValue || user.investments[investmentIndex].currentValue;
      const purchasePrice =
        req.body.purchasePrice ||
        user.investments[investmentIndex].purchasePrice;
      roi = ((currentValue - purchasePrice) / purchasePrice) * 100;
    }

    // Update investment
    user.investments[investmentIndex] = {
      ...user.investments[investmentIndex],
      name: req.body.name || user.investments[investmentIndex].name,
      type: req.body.type || user.investments[investmentIndex].type,
      currentValue:
        req.body.currentValue || user.investments[investmentIndex].currentValue,
      purchasePrice:
        req.body.purchasePrice ||
        user.investments[investmentIndex].purchasePrice,
      purchaseDate:
        req.body.purchaseDate || user.investments[investmentIndex].purchaseDate,
      roi: roi || user.investments[investmentIndex].roi,
      percentageOfPortfolio:
        req.body.percentageOfPortfolio ||
        user.investments[investmentIndex].percentageOfPortfolio,
      targetAllocation:
        req.body.targetAllocation ||
        user.investments[investmentIndex].targetAllocation,
      riskLevel:
        req.body.riskLevel || user.investments[investmentIndex].riskLevel,
      notes: req.body.notes || user.investments[investmentIndex].notes,
    };

    await user.save();

    res.status(200).json(user.investments[investmentIndex]);
  } catch (err) {
    console.error("Error updating investment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const investmentId = req.params.id;
    user.investments = user.investments.filter(
      (inv) => inv._id.toString() !== investmentId,
    );

    await user.save();

    res.status(200).json({ message: "Investment deleted successfully" });
  } catch (err) {
    console.error("Error deleting investment:", err);
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;