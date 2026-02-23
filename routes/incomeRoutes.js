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


// Income Prediction APIs

router.post("/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { month, source, amount, isRecurring, confidenceScore } = req.body;

    user.incomePredictions.push({
      month,
      source,
      amount: parseFloat(amount),
      isRecurring: isRecurring || false,
      confidenceScore: confidenceScore || 80,
      createdAt: new Date(),
    });

    await user.save();

    res.status(201).json({
      message: "Income prediction added successfully",
      predictions: user.incomePredictions,
    });
  } catch (err) {
    console.error("Error adding income prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/update/:id",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const predictionId = req.params.id;
      const { month, source, amount, isRecurring, confidenceScore } = req.body;

      const predictionIndex = user.incomePredictions.findIndex(
        (pred) => pred._id.toString() === predictionId,
      );

      if (predictionIndex === -1) {
        return res.status(404).json({ message: "Prediction not found" });
      }

      user.incomePredictions[predictionIndex] = {
        ...user.incomePredictions[predictionIndex],
        month: month || user.incomePredictions[predictionIndex].month,
        source: source || user.incomePredictions[predictionIndex].source,
        amount: amount
          ? parseFloat(amount)
          : user.incomePredictions[predictionIndex].amount,
        isRecurring:
          isRecurring !== undefined
            ? isRecurring
            : user.incomePredictions[predictionIndex].isRecurring,
        confidenceScore:
          confidenceScore ||
          user.incomePredictions[predictionIndex].confidenceScore,
      };

      await user.save();

      res.status(200).json({
        message: "Income prediction updated successfully",
        predictions: user.incomePredictions,
      });
    } catch (err) {
      console.error("Error updating income prediction:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.delete(
  "/delete/:id",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const predictionId = req.params.id;

      user.incomePredictions = user.incomePredictions.filter(
        (pred) => pred._id.toString() !== predictionId,
      );

      await user.save();

      res.status(200).json({
        message: "Income prediction deleted successfully",
        predictions: user.incomePredictions,
      });
    } catch (err) {
      console.error("Error deleting income prediction:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);



module.exports = router;