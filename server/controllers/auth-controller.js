const User = require('../model/user-model');
const bcrypt = require("bcryptjs");

// home logic //
const home = async (req, res) => {
    try {
        res.status(200).send("Home page code via controller");
    } catch (error) {
        console.log(error);
    }
};


// register logic //

const register = async (req, res, next) => {
    try {
        // console.log('Request Body:', req.body); // Add this line
        const { username, email, phone, password } = req.body;

        const userExist = await User.findOne({ email });
        if (userExist) {
            return res.status(400).json({ msg: 'Email already exists' });
        }

        // Create the user
        const userCreated = await User.create({ username, email, phone, password });
        res.status(201).json({
            msg: "Registration Successful",
            token: await userCreated.generateToken(),
            userId: userCreated._id.toString(),
        });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
        next(error)
    }
};

// login logic //

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const userExist = await User.findOne({ email });
        // console.log(userExist);
        if (!userExist) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, userExist.password);
        if (isMatch) {
            res.status(200).json({
                msg: "Login successful",
                token: await userExist.generateToken(),
                userId: userExist._id.toString(),
            });
        } else {
            return res.status(401).json({ msg: 'Invalid email or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};


//user logic


const user = async (req, res) => {
    try {
        const userData = req.user;
        // console.log(userData);
        return res.status(200).json({ userData });

    } catch (error) {
        console.log(`error from the user route ${error}`);
    }
}





module.exports = { home, register, login, user };
