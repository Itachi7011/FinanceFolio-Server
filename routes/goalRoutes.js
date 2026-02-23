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






module.exports = router;