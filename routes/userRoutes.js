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




router.post("/api/newUserRegistration", async (req, res) => {
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

router.post("/api/userLogin", async (req, res) => {

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

router.get("/api/logout", userAuthenticate, async (req, res) => {

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

router.get("/api/userProfile", userAuthenticate, async (req, res) => {
  try {
    res.send(req.rootUser);
    // console.log(req.rootUser)
  } catch (err) {
    console.log(`Error during Employeee Profile Page -${err}`);
  }
});


module.exports = router;