const express = require("express");
const router = express.Router();
const { check } = require("express-validator");

const authController = require("../controllers/authController");

const roleMiddleware = require("../middleware/roleMiddleware");

// Get auth page
router.get("/login", authController.login);

router.post(
  "/registration",
  [
    check("username", "Username cant be empty.").notEmpty(),
    check("password", "Password should be more then 8 chars.").isLength({
      min: 8,
    }),
  ],
  authController.registration
);
router.post("/login", authController.loginCheck);

router.get("/users", roleMiddleware(["ADMIN"]), authController.getUsers);

module.exports = router;
