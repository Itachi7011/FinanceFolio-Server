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
           return res.status(200).json({ message: `Welcome ${Email} on Instant Hooks` });


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


// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));