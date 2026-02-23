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


//   Bill Routes API

// 2. Get all bill reminders

router.post("/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name,
      amount,
      dueDate,
      category,
      frequency,
      status,
      reminderDays,
      autopay,
      paymentMethod,
      notes,
    } = req.body;

    const newBillReminder = {
      name,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      category: category || "Other",
      frequency: frequency || "Monthly",
      status: status || "Pending",
      isPaid: status === "Paid",
      reminderDays: reminderDays || 3,
      autopay: autopay || false,
      paymentMethod: paymentMethod || "",
      notes: notes || "",
      createdAt: new Date(),
      paymentHistory: [],
    };

    // Initialize billReminders array if it doesn't exist
    if (!user.billReminders) {
      user.billReminders = [];
    }

    user.billReminders.push(newBillReminder);
    await user.save();

    res.status(201).json({
      message: "Bill reminder added successfully",
      billReminder: newBillReminder,
    });
  } catch (err) {
    console.error("Error adding bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Sort by due date (ascending)
    const sortedReminders = user.billReminders
      ? [...user.billReminders].sort(
          (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
        )
      : [];

    res.status(200).json({
      billReminders: sortedReminders,
    });
  } catch (err) {
    console.error("Error fetching bill reminders:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. Get a specific bill reminder
router.get("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminder = user.billReminders.id(req.params.id);
    if (!billReminder)
      return res.status(404).json({ message: "Bill reminder not found" });

    res.status(200).json({ billReminder });
  } catch (err) {
    console.error("Error fetching bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 4. Update a bill reminder
router.put("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminderId = req.params.id;
    const billReminderIndex = user.billReminders.findIndex(
      (reminder) => reminder._id.toString() === billReminderId,
    );

    if (billReminderIndex === -1) {
      return res.status(404).json({ message: "Bill reminder not found" });
    }

    const {
      name,
      amount,
      dueDate,
      category,
      frequency,
      status,
      reminderDays,
      autopay,
      paymentMethod,
      notes,
    } = req.body;

    // Update fields if provided
    if (name) user.billReminders[billReminderIndex].name = name;
    if (amount)
      user.billReminders[billReminderIndex].amount = parseFloat(amount);
    if (dueDate)
      user.billReminders[billReminderIndex].dueDate = new Date(dueDate);
    if (category) user.billReminders[billReminderIndex].category = category;
    if (frequency) user.billReminders[billReminderIndex].frequency = frequency;
    if (status) {
      user.billReminders[billReminderIndex].status = status;
      user.billReminders[billReminderIndex].isPaid = status === "Paid";
    }
    if (reminderDays !== undefined)
      user.billReminders[billReminderIndex].reminderDays = reminderDays;
    if (autopay !== undefined)
      user.billReminders[billReminderIndex].autopay = autopay;
    if (paymentMethod !== undefined)
      user.billReminders[billReminderIndex].paymentMethod = paymentMethod;
    if (notes !== undefined)
      user.billReminders[billReminderIndex].notes = notes;

    await user.save();

    res.status(200).json({
      message: "Bill reminder updated successfully",
      billReminder: user.billReminders[billReminderIndex],
    });
  } catch (err) {
    console.error("Error updating bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 5. Delete a bill reminder
router.delete("/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminderId = req.params.id;
    const billReminderIndex = user.billReminders.findIndex(
      (reminder) => reminder._id.toString() === billReminderId,
    );

    if (billReminderIndex === -1) {
      return res.status(404).json({ message: "Bill reminder not found" });
    }

    // Remove the bill reminder
    user.billReminders.splice(billReminderIndex, 1);
    await user.save();

    res.status(200).json({
      message: "Bill reminder deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 6. Mark a bill as paid
router.post("/:id/pay", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminderId = req.params.id;
    const billReminder = user.billReminders.id(billReminderId);

    if (!billReminder) {
      return res.status(404).json({ message: "Bill reminder not found" });
    }

    const { amount, date } = req.body;
    const paymentAmount = parseFloat(amount) || billReminder.amount;
    const paymentDate = date ? new Date(date) : new Date();

    // Update bill status
    billReminder.status = "Paid";
    billReminder.isPaid = true;

    // Add to payment history
    billReminder.paymentHistory.push({
      date: paymentDate,
      amount: paymentAmount,
    });

    // If it's a recurring bill, generate the next one
    if (billReminder.frequency !== "One-time") {
      let nextDueDate = new Date(billReminder.dueDate);

      switch (billReminder.frequency) {
        case "Weekly":
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case "Monthly":
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case "Quarterly":
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          break;
        case "Annually":
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      const newBillReminder = {
        name: billReminder.name,
        amount: billReminder.amount,
        dueDate: nextDueDate,
        category: billReminder.category,
        frequency: billReminder.frequency,
        status: "Pending",
        isPaid: false,
        reminderDays: billReminder.reminderDays,
        autopay: billReminder.autopay,
        paymentMethod: billReminder.paymentMethod,
        notes: billReminder.notes,
        createdAt: new Date(),
        paymentHistory: [],
      };

      user.billReminders.push(newBillReminder);
    }

    await user.save();

    res.status(200).json({
      message: "Bill marked as paid successfully",
      billReminder,
    });
  } catch (err) {
    console.error("Error marking bill as paid:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 7. Get upcoming bills (due within the next 7 days)
router.get("/upcoming", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    const upcomingBills = user.billReminders.filter((bill) => {
      const dueDate = new Date(bill.dueDate);
      return (
        bill.status !== "Paid" && dueDate >= today && dueDate <= sevenDaysLater
      );
    });

    // Sort by due date (ascending)
    upcomingBills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    res.status(200).json({
      upcomingBills,
    });
  } catch (err) {
    console.error("Error fetching upcoming bills:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 8. Get overdue bills
router.get("/overdue", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date();

    const overdueBills = user.billReminders.filter((bill) => {
      const dueDate = new Date(bill.dueDate);
      return bill.status !== "Paid" && dueDate < today;
    });

    // Sort by due date (oldest first)
    overdueBills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    res.status(200).json({
      overdueBills,
    });
  } catch (err) {
    console.error("Error fetching overdue bills:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 9. Get bill payment history
router.get(
  "/:id/history",
  userAuthenticate,
  async (req, res) => {
    try {
      const user = await UsersDB.findById(req.rootUser._id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const billReminderId = req.params.id;
      const billReminder = user.billReminders.id(billReminderId);

      if (!billReminder) {
        return res.status(404).json({ message: "Bill reminder not found" });
      }

      res.status(200).json({
        paymentHistory: billReminder.paymentHistory || [],
      });
    } catch (err) {
      console.error("Error fetching bill payment history:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// 10. Get bill stats (total amount due, paid this month, etc.)
router.get("/stats", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );

    // Calculate various statistics
    let totalPendingAmount = 0;
    let totalPaidThisMonth = 0;
    let overdueAmount = 0;
    let upcomingAmount = 0;
    let billsByCategory = {};

    user.billReminders.forEach((bill) => {
      const dueDate = new Date(bill.dueDate);

      // Count pending bills
      if (bill.status === "Pending") {
        totalPendingAmount += bill.amount;

        // Count overdue amount
        if (dueDate < today) {
          overdueAmount += bill.amount;
        }

        // Count upcoming (due in next 7 days) amount
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(today.getDate() + 7);

        if (dueDate >= today && dueDate <= sevenDaysLater) {
          upcomingAmount += bill.amount;
        }
      }

      // Count payments made this month
      bill.paymentHistory.forEach((payment) => {
        const paymentDate = new Date(payment.date);
        if (paymentDate >= firstDayOfMonth && paymentDate <= lastDayOfMonth) {
          totalPaidThisMonth += payment.amount;
        }
      });

      // Group by category
      if (!billsByCategory[bill.category]) {
        billsByCategory[bill.category] = 0;
      }
      billsByCategory[bill.category] += bill.amount;
    });

    res.status(200).json({
      stats: {
        totalPendingAmount,
        totalPaidThisMonth,
        overdueAmount,
        upcomingAmount,
        billsByCategory,
      },
    });
  } catch (err) {
    console.error("Error fetching bill stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;