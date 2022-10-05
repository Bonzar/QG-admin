const express = require("express");
const router = express.Router();

const ozon_controller = require("../controllers/ozonController");
const yandex_controller = require("../controllers/yandexController");
const woocommerce_controller = require("../controllers/wooController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", (req, res) => {
  res.render("projects", {
    title: "Bonzars projects",
  });
});

// Get request for list of all Yandex products
router.get("/yandex", yandex_controller.getProductsList);

router.get(
  "/yandex/update_stock",
  authMiddleware,
  yandex_controller.updateStock
);

// Get request for list of all Ozon products
router.get("/ozon", ozon_controller.getProductsList);

router.get("/ozon/update_stock", authMiddleware, ozon_controller.updateStock);

// Get request for list of all Ozon products
router.get("/woo", woocommerce_controller.getProductsList);

// Get request for stock info depending on product type
router.get("/woo/:id/info", woocommerce_controller.getStockUpdateInfo);

// Post request for update stock info of product
router.post(
  "/woo/update_stock",
  authMiddleware,
  woocommerce_controller.updateStock
);

module.exports = router;
