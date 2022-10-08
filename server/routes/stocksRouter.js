const express = require("express");
const router = express.Router();

const ozon_controller = require("../controllers/ozonController");
const wb_controller = require("../controllers/wbController");
const yandex_controller = require("../controllers/yandexController");
const woocommerce_controller = require("../controllers/wooController");
const authMiddleware = require("../middleware/authMiddleware");

// redirect /stocks to index
router.get("/", (req, res) => {
  res.redirect("/");
});

// Get request for list of all Yandex products
router.get("/yandex", yandex_controller.getProductsList);

// Post request for update Yandex stock info of product
router.post(
  "/yandex/update_stock",
  authMiddleware,
  yandex_controller.updateStock
);

// Get request for list of all Ozon products
router.get("/ozon", ozon_controller.getProductsList);

// Post request for update Ozon stock info of product
router.post("/ozon/update_stock", authMiddleware, ozon_controller.updateStock);

// Get request for list of all Wildberries products
router.get("/wb", wb_controller.getProductsList);

// Post request for update Wildberries stock info of product
router.post("/wb/update_stock", authMiddleware, wb_controller.updateStock);

// Get request for list of all Woo products
router.get("/woo", woocommerce_controller.getProductsList);

// Get request for Wop stock info depending on product type
router.get("/woo/:id/info", woocommerce_controller.getStockUpdateInfo);

// Post request for update Woo stock info of product
router.post(
  "/woo/update_stock",
  authMiddleware,
  woocommerce_controller.updateStock
);

module.exports = router;
