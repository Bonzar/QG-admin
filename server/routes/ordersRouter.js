const express = require("express");
const router = express.Router();

const ordersController = require("../controllers/ordersController");

router.get("/all", ordersController.getOrdersList);

module.exports = router;
