const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const crypto = require('crypto');
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
const ffmpeg = require('fluent-ffmpeg');
const twilio = require('twilio');



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

require("./config/connection");


const UsersDB = require("./models/User");

const userAuthenticate = require("./authenticateFunctions/userauthenticate");


// Routes
app.get('/', (req, res) => res.send('Hello World!'));

app.post("/api/newUserRegistration", async (req, res) => {
  console.log(req.body);
  try {

    const Name = req.body.fullname;
    const Password = req.body.password;
    const Cpassword = req.body.cpassword;
    const Email = req.body.email;
    const PhoneNo = Number(req.body.phoneNo);


    // Already Used Emails

    const UsedEmail = await UsersDB.findOne({ email: Email });

    // Already Used Phone Numbers

    const UsedPhoneNo = await UsersDB.findOne({
      phoneNo: PhoneNo,
    });

    // Now acutal coding for registration
    if (Password !== Cpassword) {
      new alert("Sorry , Password And Confirm Password do not match!");
      console.log("Sorry , Password And Confirm Password do not match!");
      return res.status(400).json({ message: "Password And Confirm Password do not match." });
    }

    if (UsedEmail) {
      new alert("Sorry , This Email Id is already registered!");
      console.log("Sorry , This Email Id is already registered!");
      return res.status(400).json({ message: "This Email Id is already registered." });
    }
    if (UsedPhoneNo) {

      alert("Sorry Phone Number is already registered! \n Please use another Phone Number.");
      console.log("Sorry, Phone Number is already registered! \n Please use another Phone Number!");

      return res.status(400).json({ message: "Phone Number is already registered! Please use another Phone Number." });
    }

    function generateUniqueUsername(name) {
      // Generate a random string of 6 characters (alphanumeric)
      const randomString = crypto.randomBytes(3).toString('hex'); // 3 bytes -> 6 hex characters
      return `${name}-${randomString}`;
    }

    const userName = generateUniqueUsername(Name);

    // console.log(userName)

    const OTP = Math.floor(Math.random() * 1000000 + 1);
    const Transport = async (email, Subject, Text) => {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          service: "gmail",
          port: 587,
          secure: Boolean(true),
          auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD,
          },
        });
        await transporter.sendMail({
          from: process.env.EMAIL,
          to: Email,
          subject: Subject,
          text: Text,
        });
        console.log("Email sent successfully");

      } catch (e) {
        console.log("Error during sending email: ", e);
      }
      // Send OTP to phone number via SMS
      try {
        await twilioClient.messages.create({
          body: `Your OTP is: ${OTP}`, // Message body
          to: PhoneNo, // Phone number to send to
          from: process.env.TWILIO_PHONE_NUMBER // Your Twilio phone number
        });
        console.log("SMS sent successfully");
      } catch (error) {
        console.log("Error sending SMS: ", error);
      }

    };


    function getAge(dateString) {
      var today = new Date();
      var birthDate = new Date(dateString);
      var age = today.getFullYear() - birthDate.getFullYear();
      var m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
    const DateOfBirth = req.body.dateOfBirth;

    // Date conversion to IST

    const SubmittedDate = new Date();
    // const DateOfJoining = req.body.dateOfJoining;

    let options = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
    };
    let intlDateObj = new Intl.DateTimeFormat("en-US", options, {
      timeZone: "Asia/Kolkata",
    });

    //Form submission Date

    let ConvertedFormSubmittedDate = intlDateObj.format(SubmittedDate);


    await Transport(
      "coolsam929@gmail.com",
      "Please Use This OTP To Verify Your Insta-Hooks Account",
      ` Your OTP is : ${OTP} `
    );

    const newUserdata = await new UsersDB({
      fullname: req.body.fullname,
      userName: userName,
      userType: "User",
      email: req.body.email,
      phoneNo: req.body.phoneNo,
      gender: req.body.gender,
      country: req.body.country,
      currency: req.body.currency,
      emailVerification: false,
      dateOfBirth: req.body.dateOfBirth,
      age: getAge(DateOfBirth),
      otp: OTP,
      convertedDateOfFormSubmission: ConvertedFormSubmittedDate,
      password: req.body.password,
      dateOfFormSubmission: new Date(),
    });


    await newUserdata.save();

    console.log("Saved in Database Successfully");
    new alert(
      `${Name} Registered Successfully! \n Please Login to Continue`
    );

    res.status(200).json({ message: "Registered Successfully! \n Please Login to Continue." });

    // res.redirect("/EmployeeLogin");



  } catch (err) {
    console.log(` Error During Registering of New User --> ${err} `);
  }
}
);

app.post("/api/userLogin", async (req, res) => {

  let token;
  const Email = req.body.userEmail;
  const Password = req.body.userPassword;

  // FindOne Funtion For all of the scales database

  const data1 = await UsersDB.findOne({
    email: Email,
  });
  // io.emit("statusChanged", { userId: data1._id, status: "online" });

  if (data1) {
    const isMatch = await bcryptjs.compare(Password, data1.password);

    if (isMatch === false) {
      console.log("Login Failed");

      return res.status(400).json({ message: `Sorry Either Username Or Password is Incorrect,` });
    }
    if (isMatch === true) {
      const token = await data1.generateAuthToken();
      await UsersDB.updateOne({ _id: data1._id }, { status: "online" });

      res.cookie("cookies1", token, {
        expires: new Date(Date.now() + 2592000000),
        httpOnly: true,
      });
      console.log("Login Successful");

      // new alert( ` Welcom ${Email} on Instant Hooks`);
      return res.status(200).json({ message: `Welcome ${Email} on Finance Folio` });


    } else {
      res.send("Sorry!");
    }
  }
});

app.get("/api/logout", userAuthenticate, async (req, res) => {

  try {

    res.clearCookie("cookies1", { path: "/" }); // Ensure the path matches
    console.log("id is : ", req.rootUser._id)

    await UsersDB.updateOne({ _id: req.rootUser._id }, { status: "logout" });
    // io.emit("statusChanged", { userId: req.rootUser._id, status: "logout" });
    console.log("Logout Successful");


    res.status(200).send({ message: "Logout Successful" });

  } catch (err) {

    console.log(`Error During Logout - ${err}`);

    res.status(500).send("Error during logout");

  }

});

app.get("/api/userProfile", userAuthenticate, async (req, res) => {
  try {
    res.send(req.rootUser);
    // console.log(req.rootUser)
  } catch (err) {
    console.log(`Error during Employeee Profile Page -${err}`);
  }
});

// Budget Page

// Add new category
app.post("/api/budget/categories/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, amount, type, frequency } = req.body;

    // Check if category already exists
    const existingCategory = user.budgetCategories.find(cat => cat.name === name);
    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    user.budgetCategories.push({
      name,
      amount: parseFloat(amount),
      type,
      frequency,
      spent: 0
    });

    await user.save();

    res.status(201).json({
      message: "Category added successfully",
      categories: user.budgetCategories
    });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete category
app.delete("/api/budget/categories/delete/:name", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const categoryName = req.params.name;

    // Remove category
    user.budgetCategories = user.budgetCategories.filter(
      cat => cat.name !== categoryName
    );

    // Also remove expenses in this category
    user.expenses = user.expenses.filter(
      exp => exp.category !== categoryName
    );

    await user.save();

    res.status(200).json({
      message: "Category deleted successfully",
      categories: user.budgetCategories
    });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update category
app.put("/api/budget/categories/update/:name", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const categoryName = req.params.name;
    const { name, amount, type, frequency } = req.body;

    const categoryIndex = user.budgetCategories.findIndex(
      cat => cat.name === categoryName
    );

    if (categoryIndex === -1) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Update category
    user.budgetCategories[categoryIndex] = {
      ...user.budgetCategories[categoryIndex],
      name: name || user.budgetCategories[categoryIndex].name,
      amount: amount ? parseFloat(amount) : user.budgetCategories[categoryIndex].amount,
      type: type || user.budgetCategories[categoryIndex].type,
      frequency: frequency || user.budgetCategories[categoryIndex].frequency
    };

    // Update expenses if category name changed
    if (name && name !== categoryName) {
      user.expenses = user.expenses.map(exp => {
        if (exp.category === categoryName) {
          return { ...exp, category: name };
        }
        return exp;
      });
    }

    await user.save();

    res.status(200).json({
      message: "Category updated successfully",
      categories: user.budgetCategories
    });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add Expense
app.post("/api/budget/expenses/add", userAuthenticate, async (req, res) => {
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
      createdAt: new Date()
    });

    await user.save();

    res.status(201).json({
      message: "Expense added successfully",
      expenses: user.expenses
    });
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update Expense
app.put("/api/budget/expenses/update/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenseId = req.params.id;
    const { description, amount, category, date, paymentMethod } = req.body;

    const expenseIndex = user.expenses.findIndex(
      exp => exp._id.toString() === expenseId
    );

    if (expenseIndex === -1) {
      return res.status(404).json({ message: "Expense not found" });
    }

    user.expenses[expenseIndex] = {
      ...user.expenses[expenseIndex],
      description: description || user.expenses[expenseIndex].description,
      amount: amount ? parseFloat(amount) : user.expenses[expenseIndex].amount,
      category: category || user.expenses[expenseIndex].category,
      date: date || user.expenses[expenseIndex].date,
      paymentMethod: paymentMethod || user.expenses[expenseIndex].paymentMethod
    };

    await user.save();

    res.status(200).json({
      message: "Expense updated successfully",
      expenses: user.expenses
    });
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Expense
app.delete("/api/budget/expenses/delete/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenseId = req.params.id;

    user.expenses = user.expenses.filter(
      exp => exp._id.toString() !== expenseId
    );

    await user.save();

    res.status(200).json({
      message: "Expense deleted successfully",
      expenses: user.expenses
    });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Add these to your backend server (app.js)

// Income Prediction APIs
app.post("/api/income-predictions/add", userAuthenticate, async (req, res) => {
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
      createdAt: new Date()
    });

    await user.save();

    res.status(201).json({
      message: "Income prediction added successfully",
      predictions: user.incomePredictions
    });
  } catch (err) {
    console.error("Error adding income prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/income-predictions/update/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const predictionId = req.params.id;
    const { month, source, amount, isRecurring, confidenceScore } = req.body;

    const predictionIndex = user.incomePredictions.findIndex(
      pred => pred._id.toString() === predictionId
    );

    if (predictionIndex === -1) {
      return res.status(404).json({ message: "Prediction not found" });
    }

    user.incomePredictions[predictionIndex] = {
      ...user.incomePredictions[predictionIndex],
      month: month || user.incomePredictions[predictionIndex].month,
      source: source || user.incomePredictions[predictionIndex].source,
      amount: amount ? parseFloat(amount) : user.incomePredictions[predictionIndex].amount,
      isRecurring: isRecurring !== undefined ? isRecurring : user.incomePredictions[predictionIndex].isRecurring,
      confidenceScore: confidenceScore || user.incomePredictions[predictionIndex].confidenceScore
    };

    await user.save();

    res.status(200).json({
      message: "Income prediction updated successfully",
      predictions: user.incomePredictions
    });
  } catch (err) {
    console.error("Error updating income prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/income-predictions/delete/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const predictionId = req.params.id;

    user.incomePredictions = user.incomePredictions.filter(
      pred => pred._id.toString() !== predictionId
    );

    await user.save();

    res.status(200).json({
      message: "Income prediction deleted successfully",
      predictions: user.incomePredictions
    });
  } catch (err) {
    console.error("Error deleting income prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Expense Prediction APIs
app.post("/api/expense-predictions/add", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { category, amount, percentage, isFixed } = req.body;

    user.expensePredictions.push({
      category,
      amount: parseFloat(amount),
      percentage: percentage || 0,
      isFixed: isFixed || false,
      createdAt: new Date()
    });

    await user.save();

    res.status(201).json({
      message: "Expense prediction added successfully",
      predictions: user.expensePredictions
    });
  } catch (err) {
    console.error("Error adding expense prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/expense-predictions/update/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const predictionId = req.params.id;
    const { category, amount, percentage, isFixed } = req.body;

    const predictionIndex = user.expensePredictions.findIndex(
      pred => pred._id.toString() === predictionId
    );

    if (predictionIndex === -1) {
      return res.status(404).json({ message: "Prediction not found" });
    }

    user.expensePredictions[predictionIndex] = {
      ...user.expensePredictions[predictionIndex],
      category: category || user.expensePredictions[predictionIndex].category,
      amount: amount ? parseFloat(amount) : user.expensePredictions[predictionIndex].amount,
      percentage: percentage || user.expensePredictions[predictionIndex].percentage,
      isFixed: isFixed !== undefined ? isFixed : user.expensePredictions[predictionIndex].isFixed
    };

    await user.save();

    res.status(200).json({
      message: "Expense prediction updated successfully",
      predictions: user.expensePredictions
    });
  } catch (err) {
    console.error("Error updating expense prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/expense-predictions/delete/:id", userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const predictionId = req.params.id;

    user.expensePredictions = user.expensePredictions.filter(
      pred => pred._id.toString() !== predictionId
    );

    await user.save();

    res.status(200).json({
      message: "Expense prediction deleted successfully",
      predictions: user.expensePredictions
    });
  } catch (err) {
    console.error("Error deleting expense prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Investments API Routes
app.get('/api/investments', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.investments);
  } catch (err) {
    console.error("Error fetching investments:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/investments/add', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Calculate ROI if not provided
    let roi = req.body.roi;
    if (!roi && req.body.currentValue && req.body.purchasePrice) {
      roi = ((req.body.currentValue - req.body.purchasePrice) / req.body.purchasePrice) * 100;
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
      riskLevel: req.body.riskLevel || 'Medium',
      notes: req.body.notes || '',
      createdAt: new Date()
    };

    user.investments.push(newInvestment);
    await user.save();

    res.status(201).json(newInvestment);
  } catch (err) {
    console.error("Error adding investment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put('/api/investments/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const investmentId = req.params.id;
    const investmentIndex = user.investments.findIndex(
      inv => inv._id.toString() === investmentId
    );

    if (investmentIndex === -1) {
      return res.status(404).json({ message: "Investment not found" });
    }

    // Calculate ROI if currentValue or purchasePrice changed
    let roi = req.body.roi;
    if ((req.body.currentValue || req.body.purchasePrice) && !roi) {
      const currentValue = req.body.currentValue || user.investments[investmentIndex].currentValue;
      const purchasePrice = req.body.purchasePrice || user.investments[investmentIndex].purchasePrice;
      roi = ((currentValue - purchasePrice) / purchasePrice) * 100;
    }

    // Update investment
    user.investments[investmentIndex] = {
      ...user.investments[investmentIndex],
      name: req.body.name || user.investments[investmentIndex].name,
      type: req.body.type || user.investments[investmentIndex].type,
      currentValue: req.body.currentValue || user.investments[investmentIndex].currentValue,
      purchasePrice: req.body.purchasePrice || user.investments[investmentIndex].purchasePrice,
      purchaseDate: req.body.purchaseDate || user.investments[investmentIndex].purchaseDate,
      roi: roi || user.investments[investmentIndex].roi,
      percentageOfPortfolio: req.body.percentageOfPortfolio || user.investments[investmentIndex].percentageOfPortfolio,
      targetAllocation: req.body.targetAllocation || user.investments[investmentIndex].targetAllocation,
      riskLevel: req.body.riskLevel || user.investments[investmentIndex].riskLevel,
      notes: req.body.notes || user.investments[investmentIndex].notes
    };

    await user.save();

    res.status(200).json(user.investments[investmentIndex]);
  } catch (err) {
    console.error("Error updating investment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/investments/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const investmentId = req.params.id;
    user.investments = user.investments.filter(
      inv => inv._id.toString() !== investmentId
    );

    await user.save();

    res.status(200).json({ message: "Investment deleted successfully" });
  } catch (err) {
    console.error("Error deleting investment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Debt Management APIs
app.get('/api/debts', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.debts);
  } catch (err) {
    console.error("Error fetching debts:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/debts/add', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name, amount, interestRate, monthlyPayment, type,
      term, startDate, dueDate, notes
    } = req.body;

    const newDebt = {
      name,
      amount: parseFloat(amount),
      remainingBalance: parseFloat(amount),
      interestRate: parseFloat(interestRate),
      monthlyPayment: parseFloat(monthlyPayment),
      type,
      term,
      startDate: new Date(startDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || '',
      paymentHistory: [],
      createdAt: new Date()
    };

    user.debts.push(newDebt);
    await user.save();

    res.status(201).json({
      message: "Debt added successfully",
      debts: user.debts
    });
  } catch (err) {
    console.error("Error adding debt:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put('/api/debts/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const debtId = req.params.id;
    const debtIndex = user.debts.findIndex(d => d._id.toString() === debtId);

    if (debtIndex === -1) {
      return res.status(404).json({ message: "Debt not found" });
    }

    const {
      name, amount, interestRate, monthlyPayment, type,
      term, startDate, dueDate, notes, isPaidOff
    } = req.body;

    user.debts[debtIndex] = {
      ...user.debts[debtIndex],
      name: name || user.debts[debtIndex].name,
      amount: amount ? parseFloat(amount) : user.debts[debtIndex].amount,
      interestRate: interestRate ? parseFloat(interestRate) : user.debts[debtIndex].interestRate,
      monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment) : user.debts[debtIndex].monthlyPayment,
      type: type || user.debts[debtIndex].type,
      term: term || user.debts[debtIndex].term,
      startDate: startDate ? new Date(startDate) : user.debts[debtIndex].startDate,
      dueDate: dueDate ? new Date(dueDate) : user.debts[debtIndex].dueDate,
      notes: notes || user.debt[debtIndex].notes,
      isPaidOff: isPaidOff !== undefined ? isPaidOff : user.debts[debtIndex].isPaidOff
    };

    await user.save();

    res.status(200).json({
      message: "Debt updated successfully",
      debts: user.debts
    });
  } catch (err) {
    console.error("Error updating debt:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/debts/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const debtId = req.params.id;
    user.debts = user.debts.filter(d => d._id.toString() !== debtId);

    await user.save();

    res.status(200).json({
      message: "Debt deleted successfully",
      debts: user.debts
    });
  } catch (err) {
    console.error("Error deleting debt:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/debts/:id/payments', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const debtId = req.params.id;
    const debtIndex = user.debts.findIndex(d => d._id.toString() === debtId);

    if (debtIndex === -1) {
      return res.status(404).json({ message: "Debt not found" });
    }

    const { amount, date } = req.body;
    const paymentAmount = parseFloat(amount);
    const paymentDate = date ? new Date(date) : new Date();

    // Calculate new remaining balance
    const newBalance = user.debts[debtIndex].remainingBalance - paymentAmount;

    // Add payment to history
    user.debts[debtIndex].paymentHistory.push({
      date: paymentDate,
      amountPaid: paymentAmount,
      remainingBalance: newBalance
    });

    // Update remaining balance
    user.debts[debtIndex].remainingBalance = newBalance;

    // Mark as paid off if balance is zero
    if (newBalance <= 0) {
      user.debts[debtIndex].isPaidOff = true;
    }

    await user.save();

    res.status(201).json({
      message: "Payment recorded successfully",
      debt: user.debts[debtIndex]
    });
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Debt Calculator API
app.post('/api/debt-calculator', userAuthenticate, async (req, res) => {
  try {
    const { debtAmount, interestRate, monthlyPayment } = req.body;

    // Convert to numbers
    const amount = parseFloat(debtAmount);
    const rate = parseFloat(interestRate) / 100 / 12; // Monthly rate
    const payment = parseFloat(monthlyPayment);

    if (payment <= amount * rate) {
      return res.status(400).json({
        message: "Payment is too small to pay off debt with given interest rate"
      });
    }

    // Calculate months to payoff
    const months = Math.ceil(
      -Math.log(1 - (amount * rate) / payment) / Math.log(1 + rate)
    );

    // Calculate total interest
    const totalInterest = (payment * months) - amount;

    // Calculate payoff date
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);

    // What-if scenarios
    const scenarios = [
      { label: "Current Plan", payment: payment, months },
      {
        label: "+$50/month", payment: payment + 50, months: Math.ceil(
          -Math.log(1 - (amount * rate) / (payment + 50)) / Math.log(1 + rate)
        )
      },
      {
        label: "+$100/month", payment: payment + 100, months: Math.ceil(
          -Math.log(1 - (amount * rate) / (payment + 100)) / Math.log(1 + rate)
        )
      }
    ];

    res.status(200).json({
      monthsToPayoff: months,
      totalInterest,
      payoffDate: payoffDate.toISOString().split('T')[0],
      scenarios
    });
  } catch (err) {
    console.error("Error calculating debt payoff:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Saving Goals API Routes
app.get('/api/saving-goals', userAuthenticate, async (req, res) => {
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

app.post('/api/saving-goals/add', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name, targetAmount, currentAmount, goalDate,
      priority, category, monthlySaving, notes
    } = req.body;

    // Calculate progress percentage
    const progress = (currentAmount / targetAmount) * 100;

    const newGoal = {
      name,
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount),
      goalDate: new Date(goalDate),
      priority: priority || 'Medium',
      category: category || 'Other',
      monthlySaving: monthlySaving ? parseFloat(monthlySaving) : 0,
      notes: notes || '',
      progress,
      createdAt: new Date()
    };

    // Initialize savingGoals array if not exists
    if (!user.savingGoals) {
      user.savingGoals = [];
    }

    user.savingGoals.push(newGoal);
    await user.save();

    res.status(201).json({
      message: "Saving goal added successfully",
      goal: newGoal
    });
  } catch (err) {
    console.error("Error adding saving goal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put('/api/saving-goals/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const goalId = req.params.id;
    const goalIndex = user.savingGoals.findIndex(
      g => g._id.toString() === goalId
    );

    if (goalIndex === -1) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const {
      name, targetAmount, currentAmount, goalDate,
      priority, category, monthlySaving, notes
    } = req.body;

    // Calculate new progress
    const newCurrentAmount = currentAmount ? parseFloat(currentAmount) : user.savingGoals[goalIndex].currentAmount;
    const newTargetAmount = targetAmount ? parseFloat(targetAmount) : user.savingGoals[goalIndex].targetAmount;
    const progress = (newCurrentAmount / newTargetAmount) * 100;

    // Update goal
    user.savingGoals[goalIndex] = {
      ...user.savingGoals[goalIndex],
      name: name || user.savingGoals[goalIndex].name,
      targetAmount: newTargetAmount,
      currentAmount: newCurrentAmount,
      goalDate: goalDate ? new Date(goalDate) : user.savingGoals[goalIndex].goalDate,
      priority: priority || user.savingGoals[goalIndex].priority,
      category: category || user.savingGoals[goalIndex].category,
      monthlySaving: monthlySaving ? parseFloat(monthlySaving) : user.savingGoals[goalIndex].monthlySaving,
      notes: notes || user.savingGoals[goalIndex].notes,
      progress
    };

    await user.save();

    res.status(200).json({
      message: "Goal updated successfully",
      goal: user.savingGoals[goalIndex]
    });
  } catch (err) {
    console.error("Error updating goal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/saving-goals/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const goalId = req.params.id;
    user.savingGoals = user.savingGoals.filter(
      g => g._id.toString() !== goalId
    );

    await user.save();

    res.status(200).json({
      message: "Goal deleted successfully",
      goals: user.savingGoals
    });
  } catch (err) {
    console.error("Error deleting goal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/saving-goals/:id/contribute', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const goalId = req.params.id;
    const { amount } = req.body;
    const contributionAmount = parseFloat(amount);

    const goalIndex = user.savingGoals.findIndex(
      g => g._id.toString() === goalId
    );

    if (goalIndex === -1) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // Add contribution
    user.savingGoals[goalIndex].currentAmount += contributionAmount;

    // Update progress
    user.savingGoals[goalIndex].progress =
      (user.savingGoals[goalIndex].currentAmount / user.savingGoals[goalIndex].targetAmount) * 100;

    // Record contribution history
    if (!user.savingGoals[goalIndex].contributions) {
      user.savingGoals[goalIndex].contributions = [];
    }

    user.savingGoals[goalIndex].contributions.push({
      amount: contributionAmount,
      date: new Date(),
      notes: req.body.notes || ''
    });

    await user.save();

    res.status(200).json({
      message: "Contribution added successfully",
      goal: user.savingGoals[goalIndex]
    });
  } catch (err) {
    console.error("Error adding contribution:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/api/saving-goals/insights', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.savingGoals || user.savingGoals.length === 0) {
      return res.status(200).json({
        message: "No saving goals found",
        insights: null
      });
    }

    // Calculate basic insights
    const totalGoals = user.savingGoals.length;
    const totalTarget = user.savingGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const totalSaved = user.savingGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
    const avgProgress = user.savingGoals.reduce((sum, goal) => sum + goal.progress, 0) / totalGoals;

    // Calculate performance metrics
    const today = new Date();
    const performance = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      completed: 0
    };

    user.savingGoals.forEach(goal => {
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
      const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });

      // Filter contributions for this month
      let monthlyTotal = 0;
      let monthlyContributions = 0;

      user.savingGoals.forEach(goal => {
        if (goal.contributions) {
          goal.contributions.forEach(contribution => {
            const contDate = new Date(contribution.date);
            if (contDate.getMonth() === date.getMonth() &&
              contDate.getFullYear() === date.getFullYear()) {
              monthlyContributions += contribution.amount;
            }
          });
        }

        // Calculate progress for this month
        const createdMonth = new Date(goal.createdAt).getMonth();
        const createdYear = new Date(goal.createdAt).getFullYear();

        if ((date.getFullYear() > createdYear) ||
          (date.getFullYear() === createdYear && date.getMonth() >= createdMonth)) {
          monthlyTotal += goal.currentAmount;
        }
      });

      monthlyProgress.push({
        month: monthName,
        totalAmount: monthlyTotal,
        contribution: monthlyContributions
      });
    }

    // Generate projections
    const projections = {
      endOfYear: totalSaved + (user.savingGoals.reduce((sum, goal) => sum + (goal.monthlySaving || 0), 0) * 6),
      oneYear: totalSaved + (user.savingGoals.reduce((sum, goal) => sum + (goal.monthlySaving || 0), 0) * 12),
      fiveYear: totalSaved + (user.savingGoals.reduce((sum, goal) => sum + (goal.monthlySaving || 0), 0) * 60)
    };

    // Generate recent activity
    const recentActivity = [];
    const allContributions = [];

    user.savingGoals.forEach(goal => {
      if (goal.contributions) {
        goal.contributions.forEach(contribution => {
          allContributions.push({
            description: `Contribution to ${goal.name}`,
            amount: contribution.amount,
            date: contribution.date
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
        `You have ${performance.offTrack} goals that are off track. Consider increasing your monthly contributions or adjusting your target dates.`
      );
    }

    if (avgProgress < 50) {
      recommendations.push(
        `Your average progress is ${avgProgress.toFixed(1)}%. Try automating your savings to stay consistent.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "You're doing great with your savings goals! Keep up the good work."
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
      recommendations
    });
  } catch (err) {
    console.error("Error generating insights:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/bill-reminders/add', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name, amount, dueDate, category, frequency,
      status, reminderDays, autopay, paymentMethod, notes
    } = req.body;

    const newBillReminder = {
      name,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      category: category || 'Other',
      frequency: frequency || 'Monthly',
      status: status || 'Pending',
      isPaid: status === 'Paid',
      reminderDays: reminderDays || 3,
      autopay: autopay || false,
      paymentMethod: paymentMethod || '',
      notes: notes || '',
      createdAt: new Date(),
      paymentHistory: []
    };

    // Initialize billReminders array if it doesn't exist
    if (!user.billReminders) {
      user.billReminders = [];
    }

    user.billReminders.push(newBillReminder);
    await user.save();

    res.status(201).json({
      message: "Bill reminder added successfully",
      billReminder: newBillReminder
    });
  } catch (err) {
    console.error("Error adding bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 2. Get all bill reminders
app.get('/api/bill-reminders', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Sort by due date (ascending)
    const sortedReminders = user.billReminders ?
      [...user.billReminders].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      : [];


    res.status(200).json({
      billReminders: sortedReminders
    });
  } catch (err) {
    console.error("Error fetching bill reminders:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. Get a specific bill reminder
app.get('/api/bill-reminders/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminder = user.billReminders.id(req.params.id);
    if (!billReminder) return res.status(404).json({ message: "Bill reminder not found" });

    res.status(200).json({ billReminder });
  } catch (err) {
    console.error("Error fetching bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 4. Update a bill reminder
app.put('/api/bill-reminders/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminderId = req.params.id;
    const billReminderIndex = user.billReminders.findIndex(
      reminder => reminder._id.toString() === billReminderId
    );

    if (billReminderIndex === -1) {
      return res.status(404).json({ message: "Bill reminder not found" });
    }

    const {
      name, amount, dueDate, category, frequency,
      status, reminderDays, autopay, paymentMethod, notes
    } = req.body;

    // Update fields if provided
    if (name) user.billReminders[billReminderIndex].name = name;
    if (amount) user.billReminders[billReminderIndex].amount = parseFloat(amount);
    if (dueDate) user.billReminders[billReminderIndex].dueDate = new Date(dueDate);
    if (category) user.billReminders[billReminderIndex].category = category;
    if (frequency) user.billReminders[billReminderIndex].frequency = frequency;
    if (status) {
      user.billReminders[billReminderIndex].status = status;
      user.billReminders[billReminderIndex].isPaid = status === 'Paid';
    }
    if (reminderDays !== undefined) user.billReminders[billReminderIndex].reminderDays = reminderDays;
    if (autopay !== undefined) user.billReminders[billReminderIndex].autopay = autopay;
    if (paymentMethod !== undefined) user.billReminders[billReminderIndex].paymentMethod = paymentMethod;
    if (notes !== undefined) user.billReminders[billReminderIndex].notes = notes;

    await user.save();

    res.status(200).json({
      message: "Bill reminder updated successfully",
      billReminder: user.billReminders[billReminderIndex]
    });
  } catch (err) {
    console.error("Error updating bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 5. Delete a bill reminder
app.delete('/api/bill-reminders/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminderId = req.params.id;
    const billReminderIndex = user.billReminders.findIndex(
      reminder => reminder._id.toString() === billReminderId
    );

    if (billReminderIndex === -1) {
      return res.status(404).json({ message: "Bill reminder not found" });
    }

    // Remove the bill reminder
    user.billReminders.splice(billReminderIndex, 1);
    await user.save();

    res.status(200).json({
      message: "Bill reminder deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting bill reminder:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 6. Mark a bill as paid
app.post('/api/bill-reminders/:id/pay', userAuthenticate, async (req, res) => {
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
    billReminder.status = 'Paid';
    billReminder.isPaid = true;

    // Add to payment history
    billReminder.paymentHistory.push({
      date: paymentDate,
      amount: paymentAmount
    });

    // If it's a recurring bill, generate the next one
    if (billReminder.frequency !== 'One-time') {
      let nextDueDate = new Date(billReminder.dueDate);

      switch (billReminder.frequency) {
        case 'Weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case 'Monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'Quarterly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          break;
        case 'Annually':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      const newBillReminder = {
        name: billReminder.name,
        amount: billReminder.amount,
        dueDate: nextDueDate,
        category: billReminder.category,
        frequency: billReminder.frequency,
        status: 'Pending',
        isPaid: false,
        reminderDays: billReminder.reminderDays,
        autopay: billReminder.autopay,
        paymentMethod: billReminder.paymentMethod,
        notes: billReminder.notes,
        createdAt: new Date(),
        paymentHistory: []
      };

      user.billReminders.push(newBillReminder);
    }

    await user.save();

    res.status(200).json({
      message: "Bill marked as paid successfully",
      billReminder
    });
  } catch (err) {
    console.error("Error marking bill as paid:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 7. Get upcoming bills (due within the next 7 days)
app.get('/api/bill-reminders/upcoming', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    const upcomingBills = user.billReminders.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      return bill.status !== 'Paid' && dueDate >= today && dueDate <= sevenDaysLater;
    });

    // Sort by due date (ascending)
    upcomingBills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    res.status(200).json({
      upcomingBills
    });
  } catch (err) {
    console.error("Error fetching upcoming bills:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 8. Get overdue bills
app.get('/api/bill-reminders/overdue', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date();

    const overdueBills = user.billReminders.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      return bill.status !== 'Paid' && dueDate < today;
    });

    // Sort by due date (oldest first)
    overdueBills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    res.status(200).json({
      overdueBills
    });
  } catch (err) {
    console.error("Error fetching overdue bills:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 9. Get bill payment history
app.get('/api/bill-reminders/:id/history', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const billReminderId = req.params.id;
    const billReminder = user.billReminders.id(billReminderId);

    if (!billReminder) {
      return res.status(404).json({ message: "Bill reminder not found" });
    }

    res.status(200).json({
      paymentHistory: billReminder.paymentHistory || []
    });
  } catch (err) {
    console.error("Error fetching bill payment history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 10. Get bill stats (total amount due, paid this month, etc.)
app.get('/api/bill-reminders/stats', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Calculate various statistics
    let totalPendingAmount = 0;
    let totalPaidThisMonth = 0;
    let overdueAmount = 0;
    let upcomingAmount = 0;
    let billsByCategory = {};

    user.billReminders.forEach(bill => {
      const dueDate = new Date(bill.dueDate);

      // Count pending bills
      if (bill.status === 'Pending') {
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
      bill.paymentHistory.forEach(payment => {
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
        billsByCategory
      }
    });
  } catch (err) {
    console.error("Error fetching bill stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Tax Tips API Routes
app.get('/api/tax-tips', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxTips);
  } catch (err) {
    console.error("Error fetching tax tips:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/tax-tips', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { title, content, category } = req.body;

    user.taxTips.push({
      title,
      content,
      category: category || 'individual'
    });

    await user.save();

    res.status(201).json({
      message: "Tax tip added successfully",
      tip: user.taxTips[user.taxTips.length - 1]
    });
  } catch (err) {
    console.error("Error adding tax tip:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put('/api/tax-tips/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const tipId = req.params.id;
    const { title, content, category } = req.body;

    const tipIndex = user.taxTips.findIndex(tip => tip._id.toString() === tipId);
    if (tipIndex === -1) return res.status(404).json({ message: "Tax tip not found" });

    user.taxTips[tipIndex] = {
      ...user.taxTips[tipIndex],
      title: title || user.taxTips[tipIndex].title,
      content: content || user.taxTips[tipIndex].content,
      category: category || user.taxTips[tipIndex].category
    };

    await user.save();

    res.status(200).json({
      message: "Tax tip updated successfully",
      tip: user.taxTips[tipIndex]
    });
  } catch (err) {
    console.error("Error updating tax tip:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/tax-tips/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const tipId = req.params.id;
    user.taxTips = user.taxTips.filter(tip => tip._id.toString() !== tipId);

    await user.save();

    res.status(200).json({
      message: "Tax tip deleted successfully",
      tips: user.taxTips
    });
  } catch (err) {
    console.error("Error deleting tax tip:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Tax Deductions API Routes (similar structure as above)
app.get('/api/tax-deductions', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxDeductions);
  } catch (err) {
    console.error("Error fetching tax deductions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/tax-deductions', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, description, eligibility, maxAmount } = req.body;

    user.taxDeductions.push({
      name,
      description,
      eligibility,
      maxAmount
    });

    await user.save();

    res.status(201).json({
      message: "Tax deduction added successfully",
      deduction: user.taxDeductions[user.taxDeductions.length - 1]
    });
  } catch (err) {
    console.error("Error adding tax deduction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add similar PUT and DELETE endpoints for tax deductions

// Tax Predictions API Routes (similar structure)
app.get('/api/tax-predictions', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxPredictions);
  } catch (err) {
    console.error("Error fetching tax predictions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/tax-predictions', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { year, title, content, impact } = req.body;

    user.taxPredictions.push({
      year,
      title,
      content,
      impact: impact || 'low'
    });

    await user.save();

    res.status(201).json({
      message: "Tax prediction added successfully",
      prediction: user.taxPredictions[user.taxPredictions.length - 1]
    });
  } catch (err) {
    console.error("Error adding tax prediction:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add similar PUT and DELETE endpoints for tax predictions

// Tax FAQs API Routes (similar structure)
app.get('/api/tax-faqs', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.taxFaqs);
  } catch (err) {
    console.error("Error fetching tax FAQs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/tax-faqs', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { question, answer, category } = req.body;

    user.taxFaqs.push({
      question,
      answer,
      category: category || 'general'
    });

    await user.save();

    res.status(201).json({
      message: "Tax FAQ added successfully",
      faq: user.taxFaqs[user.taxFaqs.length - 1]
    });
  } catch (err) {
    console.error("Error adding tax FAQ:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Expense CRUD operations
app.post('/api/expenses', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { description, amount, category, date, paymentMethod } = req.body;

    user.expenses.push({
      description,
      amount: parseFloat(amount),
      category,
      date: date || new Date(),
      paymentMethod: paymentMethod || "Credit Card"
    });

    await user.save();

    res.status(201).json({
      message: "Expense added successfully",
      expense: user.expenses[user.expenses.length - 1]
    });
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put('/api/expenses/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenseId = req.params.id;
    const { description, amount, category, date, paymentMethod } = req.body;

    const expenseIndex = user.expenses.findIndex(
      exp => exp._id.toString() === expenseId
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
      paymentMethod: paymentMethod || user.expenses[expenseIndex].paymentMethod
    };

    await user.save();

    res.status(200).json({
      message: "Expense updated successfully",
      expense: user.expenses[expenseIndex]
    });
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/expenses/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenseId = req.params.id;

    user.expenses = user.expenses.filter(
      exp => exp._id.toString() !== expenseId
    );

    await user.save();

    res.status(200).json({
      message: "Expense deleted successfully",
      expenses: user.expenses
    });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Milestones APIs
app.get('/api/milestones', userAuthenticate, async (req, res) => {
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

app.post('/api/milestones', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { title, description, targetDate, targetAmount, category, currentAmount } = req.body;

    // Calculate progress
    const progress = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;

    const newMilestone = {
      title,
      description,
      targetDate: new Date(targetDate),
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount || 0),
      category: category || 'savings',
      progress,
      createdAt: new Date()
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

app.put('/api/milestones/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const milestoneId = req.params.id;
    const { title, description, targetDate, targetAmount, category, currentAmount } = req.body;

    const milestoneIndex = user.milestones.findIndex(
      m => m._id.toString() === milestoneId
    );

    if (milestoneIndex === -1) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    // Calculate new progress
    const newTargetAmount = parseFloat(targetAmount || user.milestones[milestoneIndex].targetAmount);
    const newCurrentAmount = parseFloat(currentAmount || user.milestones[milestoneIndex].currentAmount);
    const progress = newTargetAmount > 0 ? Math.round((newCurrentAmount / newTargetAmount) * 100) : 0;

    // Update milestone
    user.milestones[milestoneIndex] = {
      ...user.milestones[milestoneIndex],
      title: title || user.milestones[milestoneIndex].title,
      description: description || user.milestones[milestoneIndex].description,
      targetDate: targetDate ? new Date(targetDate) : user.milestones[milestoneIndex].targetDate,
      targetAmount: newTargetAmount,
      currentAmount: newCurrentAmount,
      category: category || user.milestones[milestoneIndex].category,
      progress
    };

    await user.save();

    res.status(200).json(user.milestones[milestoneIndex]);
  } catch (err) {
    console.error("Error updating milestone:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/milestones/:id', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const milestoneId = req.params.id;
    user.milestones = user.milestones.filter(
      m => m._id.toString() !== milestoneId
    );

    await user.save();

    res.status(200).json({ message: "Milestone deleted successfully" });
  } catch (err) {
    console.error("Error deleting milestone:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Financial Data API
app.get('/api/financial-data', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize financialData if it doesn't exist
    if (!user.financialData) {
      user.financialData = {
        netWorth: 0,
        savingsRate: 0,
        debtToIncomeRatio: 0,
        emergencyFundMonths: 0,
        diversificationScore: 0,
        budgetAdherenceScore: 0
      };
      await user.save();
    }

    res.status(200).json(user.financialData);
  } catch (err) {
    console.error("Error fetching financial data:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Insights API
app.get('/api/insights', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize insights array if it doesn't exist
    if (!user.insights) {
      user.insights = [];
      await user.save();
    }

    res.status(200).json(user.insights);
  } catch (err) {
    console.error("Error fetching insights:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Projections API
app.get('/api/projections', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Initialize projections if it doesn't exist
    if (!user.projections) {
      user.projections = {
        conservative: [],
        moderate: [],
        aggressive: []
      };
      await user.save();
    }

    res.status(200).json(user.projections);
  } catch (err) {
    console.error("Error fetching projections:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update financial health score
app.post('/api/update-financial-health', userAuthenticate, async (req, res) => {
  try {
    const user = await UsersDB.findById(req.rootUser._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { score } = req.body;

    if (!user.financialData) {
      user.financialData = {};
    }

    user.financialData.healthScore = score;
    await user.save();

    res.status(200).json({ message: "Financial health score updated successfully" });
  } catch (err) {
    console.error("Error updating financial health score:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Financial Progress Routes
app.get('/api/financial-health', userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await NewUserRegistration.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        score: 0,
        message: "User not found"
      });
    }
    
    // Provide default values if calculations fail
    const savingsRate = calculateSavingsRate(user) || 0;
    const debtRatio = calculateDebtToIncomeRatio(user) || 0;
    const budgetAdherence = calculateBudgetAdherence(user) || 0;
    const diversificationScore = calculateDiversificationScore(user) || 0;
    const emergencyFundStatus = calculateEmergencyFundStatus(user) || 0;
    
    const score = Math.round(
      (savingsRate * 20) +
      (debtRatio * 20) +
      (budgetAdherence * 20) +
      (diversificationScore * 20) +
      (emergencyFundStatus * 20)
    );
    
    res.status(200).json({ 
      score: Math.min(score, 100),
      savingsRate,
      debtToIncomeRatio: debtRatio,
      budgetAdherenceScore: budgetAdherence,
      diversificationScore,
      emergencyFundMonths: emergencyFundStatus * 6 // Convert to months
    });
  } catch (error) {
    console.error('Financial health error:', error);
    res.status(200).json({ 
      score: 0,
      message: "Using default values due to calculation error"
    });
  }
});

app.get('/api/financial-metrics', userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await NewUserRegistration.findById(userId);
    
    if (!user) {
      return res.status(200).json({
        netWorth: 0,
        savingsRate: 0,
        debtToIncome: 0,
        emergencyFundMonths: 0,
        message: "User not found, using default values"
      });
    }
    
    // Provide default values if calculations fail
    const netWorth = calculateNetWorth(user) || 0;
    const savingsRate = calculateSavingsRate(user) || 0;
    const debtToIncome = calculateDebtToIncomeRatio(user) || 0;
    const emergencyFundMonths = calculateEmergencyFundMonths(user) || 0;
    
    res.status(200).json({
      netWorth,
      savingsRate,
      debtToIncome,
      emergencyFundMonths
    });
  } catch (error) {
    console.error('Financial metrics error:', error);
    res.status(200).json({
      netWorth: 0,
      savingsRate: 0,
      debtToIncome: 0,
      emergencyFundMonths: 0,
      message: "Using default values due to calculation error"
    });
  }
});

app.get('/api/milestones',userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await NewUserRegistration.findById(userId);
    res.status(200).json(user.savingGoals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// app.post('/api/milestones',userAuthenticate, async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const milestone = req.body;
    
//     const user = await NewUserRegistration.findByIdAndUpdate(
//       userId,
//       { $push: { savingGoals: milestone } },
//       { new: true }
//     );
    
//     res.status(201).json(user.savingGoals);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

app.put('/api/milestones/:id',userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const milestoneId = req.params.id;
    const updates = req.body;
    
    const user = await NewUserRegistration.findOneAndUpdate(
      { _id: userId, "savingGoals._id": milestoneId },
      { $set: { "savingGoals.$": updates } },
      { new: true }
    );
    
    res.status(200).json(user.savingGoals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/milestones/:id',userAuthenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const milestoneId = req.params.id;
    
    const user = await NewUserRegistration.findByIdAndUpdate(
      userId,
      { $pull: { savingGoals: { _id: milestoneId } } },
      { new: true }
    );
    
    res.status(200).json(user.savingGoals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/allUsersList", async (req, res) => {
  try {
    const data = await UsersDB.find();

    res.send(data);
  } catch (err) {
    console.log(err);
  }
});

// Get all users
app.get("/api/allUsersList", async (req, res) => {
  try {
    const data = await UsersDB.find();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Get single user
app.get("/api/users/:id", async (req, res) => {
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
app.post("/api/users", async (req, res) => {
  try {
    const { fullname, email, userName, password, userType } = req.body;
    
    // Validate input
    if (!fullname || !email || !userName || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user exists
    const existingUser = await UsersDB.findOne({ $or: [{ email }, { userName }] });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email or username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UsersDB({
      fullname,
      email,
      userName,
      password: hashedPassword,
      userType: userType || 'User',
      dateOfFormSubmission: new Date()
    });

    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating user" });
  }
});

// Update user
app.put("/api/users/:id", async (req, res) => {
  try {
    const { fullname, userName, userType } = req.body;
    const updatedUser = await UsersDB.findByIdAndUpdate(
      req.params.id,
      { fullname, userName, userType },
      { new: true }
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
app.delete("/api/users/:id", async (req, res) => {
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
app.post("/api/users/bulk-delete", async (req, res) => {
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
app.post("/api/users/verify", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.updateMany(
      { _id: { $in: userIds } },
      { $set: { emailVerification: true } }
    );
    res.json({ message: "Users verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error verifying users" });
  }
});

// Block users
app.post("/api/users/block", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.updateMany(
      { _id: { $in: userIds } },
      { $set: { isBlocked: true } }
    );
    res.json({ message: "Users blocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error blocking users" });
  }
});

// Unblock users
app.post("/api/users/unblock", async (req, res) => {
  try {
    const { userIds } = req.body;
    await UsersDB.updateMany(
      { _id: { $in: userIds } },
      { $set: { isBlocked: false } }
    );
    res.json({ message: "Users unblocked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error unblocking users" });
  }
});


// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));