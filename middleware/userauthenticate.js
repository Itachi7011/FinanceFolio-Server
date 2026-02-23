const jwt = require("jsonwebtoken");


const usersDB = require("../models/Users/User");

const customerauthenticate = async (req, res, next) => {

    try {

        const token = req.cookies.cookies1;
        const verifyToken = jwt.verify(token, process.env.SECRET_KEY);
        

        const rootUser = await usersDB.findOne({ _id: verifyToken._id, "tokens": token })



        

        if (rootUser) {
            req.token = token;
            req.rootUser = rootUser;
            req.id = rootUser._id;

        } 

        next();

    } catch (err) {
        res.status(401).send("UnAuthorised User, No Token Found!")
        console.log(`UnAuthorised User - ${err}`);
    }
}
module.exports = customerauthenticate;
