const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const os = require("os");
const moment = require("moment");
const si = require("systeminformation");
const exec = require("child_process").exec;
const shortid = require("shortid");
const alert = require("electron-alert");
const multer = require("multer");
const bcryptjs = require("bcryptjs");
const cookieParser = require("cookie-parser");
const schedule = require("node-schedule");
const ffmpeg = require("fluent-ffmpeg");
const twilio = require("twilio");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const PORT = process.env.PORT || 7000;

// Load environment variables
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Create Express app
const app = express();

const twilioClient = twilio(accountSid, authToken);

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts per hour
  skipSuccessfulRequests: true,
});

require("./config/connection");

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Session management
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({
//       mongoUrl: process.env.MONGODB_URI,
//       ttl: 14 * 24 * 60 * 60, // 14 days
//       autoRemove: "native",
//     }),
//     cookie: {
//       secure: process.env.NODE_ENV === "production",
//       httpOnly: true,
//       maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
//       sameSite: "strict",
//     },
//   }),
// );

// const UsersDB = require("./models/Users/User");

const UsersRoutes = require("./routes/userRoutes");
const BudgetRoutes = require("./routes/budgetRoutes");
const DebtRoutes = require("./routes/debtRoutes");
const IncomePredictionRoutes = require("./routes/incomeRoutes");
const InvestmentRoutes = require("./routes/investmentRoutes");
const BillReminderRoutes = require("./routes/billRoutes");
const SavingGoalsRoutes = require("./routes/savingRoutes");
const TaxRoutes = require("./routes/taxRoutes");


app.use("/api/users/", UsersRoutes);
app.use("/api/budget/", BudgetRoutes);
app.use("/api/debts/", DebtRoutes);
app.use("/api/income-predictions/", IncomePredictionRoutes);
app.use("/api/investments/", InvestmentRoutes);
app.use("/api/bill-reminders/", BillReminderRoutes);
app.use("/api/saving-goals/", SavingGoalsRoutes);
app.use("/api/tax/", TaxRoutes);



// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
