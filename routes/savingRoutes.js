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


// Saving Goals API Routes


router.get("/", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Add savingGoals array to user schema if not exists
    if (!user.savingGoals) {
      user.savingGoals = [];
      await user.save();
    }

    res.status(200).json(user.savingGoals);
  } catch (err) {
    console.error("Error fetching saving goals:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name,
      targetAmount,
      currentAmount,
      goalDate,
      priority,
      category,
      monthlySaving,
      notes,
    } = req.body;

    // Calculate progress percentage
    const progress = (currentAmount / targetAmount) * 100;

    const newGoal = {
      name,
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount),
      goalDate: new Date(goalDate),
      priority: priority || "Medium",
      category: category || "Other",
      monthlySaving: monthlySaving ? parseFloat(monthlySaving) : 0,
      notes: notes || "",
      progress,
      createdAt: new Date(),
    };

    // Initialize savingGoals array if not exists
    if (!user.savingGoals) {
      user.savingGoals = [];
    }

    user.savingGoals.push(newGoal);
    await user.save();

    res.status(201).json({
      message: "Saving goal added successfully",
      goal: newGoal,
    });
  } catch (err) {
    console.error("Error adding saving goal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const goalId = req.params.id;
    const goalIndex = user.savingGoals.findIndex(
      (g) => g._id.toString() === goalId,
    );

    if (goalIndex === -1) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const {
      name,
      targetAmount,
      currentAmount,
      goalDate,
      priority,
      category,
      monthlySaving,
      notes,
    } = req.body;

    // Calculate new progress
    const newCurrentAmount = currentAmount
      ? parseFloat(currentAmount)
      : user.savingGoals[goalIndex].currentAmount;
    const newTargetAmount = targetAmount
      ? parseFloat(targetAmount)
      : user.savingGoals[goalIndex].targetAmount;
    const progress = (newCurrentAmount / newTargetAmount) * 100;

    // Update goal
    user.savingGoals[goalIndex] = {
      ...user.savingGoals[goalIndex],
      name: name || user.savingGoals[goalIndex].name,
      targetAmount: newTargetAmount,
      currentAmount: newCurrentAmount,
      goalDate: goalDate
        ? new Date(goalDate)
        : user.savingGoals[goalIndex].goalDate,
      priority: priority || user.savingGoals[goalIndex].priority,
      category: category || user.savingGoals[goalIndex].category,
      monthlySaving: monthlySaving
        ? parseFloat(monthlySaving)
        : user.savingGoals[goalIndex].monthlySaving,
      notes: notes || user.savingGoals[goalIndex].notes,
      progress,
    };

    await user.save();

    res.status(200).json({
      message: "Goal updated successfully",
      goal: user.savingGoals[goalIndex],
    });
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const goalId = req.params.id;
    user.savingGoals = user.savingGoals.filter(
      (g) => g._id.toString() !== goalId,
    );

    await user.save();

    res.status(200).json({
      message: "Goal deleted successfully",
      goals: user.savingGoals,
    });
  } catch (err) {
    console.error("Error deleting goal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/:id/contribute",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const goalId = req.params.id;
      const { amount } = req.body;
      const contributionAmount = parseFloat(amount);

      const goalIndex = user.savingGoals.findIndex(
        (g) => g._id.toString() === goalId,
      );

      if (goalIndex === -1) {
        return res.status(404).json({ message: "Goal not found" });
      }

      // Add contribution
      user.savingGoals[goalIndex].currentAmount += contributionAmount;

      // Update progress
      user.savingGoals[goalIndex].progress =
        (user.savingGoals[goalIndex].currentAmount /
          user.savingGoals[goalIndex].targetAmount) *
        100;

      // Record contribution history
      if (!user.savingGoals[goalIndex].contributions) {
        user.savingGoals[goalIndex].contributions = [];
      }

      user.savingGoals[goalIndex].contributions.push({
        amount: contributionAmount,
        date: new Date(),
        notes: req.body.notes || "",
      });

      await user.save();

      res.status(200).json({
        message: "Contribution added successfully",
        goal: user.savingGoals[goalIndex],
      });
    } catch (err) {
      console.error("Error adding contribution:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

router.get("/insights", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.savingGoals || user.savingGoals.length === 0) {
      return res.status(200).json({
        message: "No saving goals found",
        insights: null,
      });
    }

    // Calculate basic insights
    const totalGoals = user.savingGoals.length;
    const totalTarget = user.savingGoals.reduce(
      (sum, goal) => sum + goal.targetAmount,
      0,
    );
    const totalSaved = user.savingGoals.reduce(
      (sum, goal) => sum + goal.currentAmount,
      0,
    );
    const avgProgress =
      user.savingGoals.reduce((sum, goal) => sum + goal.progress, 0) /
      totalGoals;

    // Calculate performance metrics
    const today = new Date();
    const performance = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      completed: 0,
    };

    user.savingGoals.forEach((goal) => {
      const timeElapsed = today - new Date(goal.createdAt);
      const totalDuration = new Date(goal.goalDate) - new Date(goal.createdAt);
      const timeProgress = (timeElapsed / totalDuration) * 100;

      if (goal.progress >= 100) {
        performance.completed++;
      } else if (goal.progress >= timeProgress) {
        performance.onTrack++;
      } else if (goal.progress >= timeProgress - 20) {
        performance.atRisk++;
      } else {
        performance.offTrack++;
      }
    });

    // Generate monthly progress data
    const monthlyProgress = [];
    const months = 6; // Last 6 months

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      // Filter contributions for this month
      let monthlyTotal = 0;
      let monthlyContributions = 0;

      user.savingGoals.forEach((goal) => {
        if (goal.contributions) {
          goal.contributions.forEach((contribution) => {
            const contDate = new Date(contribution.date);
            if (
              contDate.getMonth() === date.getMonth() &&
              contDate.getFullYear() === date.getFullYear()
            ) {
              monthlyContributions += contribution.amount;
            }
          });
        }

        // Calculate progress for this month
        const createdMonth = new Date(goal.createdAt).getMonth();
        const createdYear = new Date(goal.createdAt).getFullYear();

        if (
          date.getFullYear() > createdYear ||
          (date.getFullYear() === createdYear &&
            date.getMonth() >= createdMonth)
        ) {
          monthlyTotal += goal.currentAmount;
        }
      });

      monthlyProgress.push({
        month: monthName,
        totalAmount: monthlyTotal,
        contribution: monthlyContributions,
      });
    }

    // Generate projections
    const projections = {
      endOfYear:
        totalSaved +
        user.savingGoals.reduce(
          (sum, goal) => sum + (goal.monthlySaving || 0),
          0,
        ) *
          6,
      oneYear:
        totalSaved +
        user.savingGoals.reduce(
          (sum, goal) => sum + (goal.monthlySaving || 0),
          0,
        ) *
          12,
      fiveYear:
        totalSaved +
        user.savingGoals.reduce(
          (sum, goal) => sum + (goal.monthlySaving || 0),
          0,
        ) *
          60,
    };

    // Generate recent activity
    const recentActivity = [];
    const allContributions = [];

    user.savingGoals.forEach((goal) => {
      if (goal.contributions) {
        goal.contributions.forEach((contribution) => {
          allContributions.push({
            description: `Contribution to ${goal.name}`,
            amount: contribution.amount,
            date: contribution.date,
          });
        });
      }
    });

    // Sort by date and get last 5
    allContributions.sort((a, b) => new Date(b.date) - new Date(a.date));
    recentActivity.push(...allContributions.slice(0, 5));

    // Generate recommendations
    const recommendations = [];
    if (performance.offTrack > 0) {
      recommendations.push(
        `You have ${performance.offTrack} goals that are off track. Consider increasing your monthly contributions or adjusting your target dates.`,
      );
    }

    if (avgProgress < 50) {
      recommendations.push(
        `Your average progress is ${avgProgress.toFixed(1)}%. Try automating your savings to stay consistent.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "You're doing great with your savings goals! Keep up the good work.",
      );
    }

    res.status(200).json({
      totalGoals,
      totalTarget,
      totalSaved,
      avgProgress,
      performance,
      monthlyProgress,
      projections,
      recentActivity,
      recommendations,
    });
  } catch (err) {
    console.error("Error generating insights:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;