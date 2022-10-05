const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

const generateAccessToken = (id, roles) => {
  const payload = {
    id,
    roles,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });
};

exports.registration = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Ошибка при валидации полей регистрации",
        errors: errors.array(),
      });
    }
    const { username, password } = req.body;
    const candidate = await User.findOne({ username });
    if (candidate) {
      return res
        .status(400)
        .json({ message: "Пользователь с таким именем уже существует" });
    }
    const hashPassword = bcrypt.hashSync(password, 7);
    const userRole = await Role.findOne({ value: "USER" });

    const user = new User({
      username,
      password: hashPassword,
      roles: [userRole.value],
    });
    await user.save();
    return res.json({ message: "Registration success!" });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Registration Error" });
  }
};

exports.login = (req, res) => {
  try {
    res.render("login", { title: "Авторизация" });
  } catch (e) {
    console.log(e);
    return res
      .status(400)
      .json({ message: "Ошибка при загрузки страницы входа." });
  }
};

exports.loginCheck = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.render("login", {
        title: "Авторизация",
        errors: [`Пользователь ${username} не найден`],
      });
    }
    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return res.render("login", {
        title: "Авторизация",
        errors: [`Введен не верный пароль`],
        username,
      });
    }

    const authToken = generateAccessToken(user._id, user.roles);

    return res.render("login", {
      title: `Добро пожаловать ${username}`,
      authToken,
      username,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Login Error" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Get userlist Error" });
  }
};
