import express from "express";
import * as ordersController from "../controllers/ordersController.js";

const router = express.Router();
router.get("/all", ordersController.getOrdersList);

export default router;
