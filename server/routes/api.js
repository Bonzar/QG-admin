const express = require("express");
const router = express.Router();

const ozon_controller = require("../controllers/ozonController");
const yandex_controller = require("../controllers/yandexController");

// Get request for list of all Yandex products
router.get("/yandex", yandex_controller.product_list);

// Get request for list of all Ozon products
router.get("/ozon", ozon_controller.product_list);

module.exports = router;
