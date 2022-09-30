const express = require("express");
const router = express.Router();

const ozon_controller = require("../controllers/ozonController");
const yandex_controller = require("../controllers/yandexController");
const woocommerce_controller = require("../controllers/woocommerceController");

router.get("/", (req, res) => {
  res.render("projects", {
    title: "Bonzars projects",
  });
});

// Get request for list of all Yandex products
router.get("/yandex", yandex_controller.product_list);

router.get("/yandex/update_stock", yandex_controller.update_stock);

// Get request for list of all Ozon products
router.get("/ozon", ozon_controller.product_list);

// Get request for list of all Ozon products
router.get("/woo", woocommerce_controller.product_list);

// Get request for stock info depending on product type
router.get("/woo/:id/info", woocommerce_controller.getStockUpdateInfo);

// Put request for update stock info of product
router.post("/woo/update_stock", woocommerce_controller.updateStock);

module.exports = router;
