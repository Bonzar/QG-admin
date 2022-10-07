const express = require("express");
const router = express.Router();

const shipmentsController = require("../controllers/shipmentsController");

router.get("/ozon", shipmentsController.getOzonShipment);

module.exports = router;
