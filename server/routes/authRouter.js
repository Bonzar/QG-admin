import express from "express";
import { check } from "express-validator";
import * as authController from "../controllers/authController.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";

const router = express.Router();

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

export default router;
