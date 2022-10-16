const express = require("express");
const router = express.Router();

const ozon_controller = require("../controllers/ozonController");
const wb_controller = require("../controllers/wbController");
const yandex_controller = require("../controllers/yandexController");
const woocommerce_controller = require("../controllers/wooController");
const productDbController = require("../controllers/dbController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { body } = require("express-validator");

// index page with stock tables list
router.get("/", (req, res) => {
  try {
    res.render("stocks", { title: "Наличие" });
  } catch (e) {
    console.log(e);
    res
      .status(400)
      .json({ message: "Ошибка при загрузке страницы. Попробуйте позже." });
  }
});

// Get request for product page
router.get("/variation/:id", productDbController.getProductVariationPage);

// Get request for list of all Yandex products
router.get("/yandex", yandex_controller.getProductsListPage);

// Post request for update Yandex stock info of product
router.post(
  "/yandex/update_stock",
  authMiddleware,
  yandex_controller.updateApiStock
);
const productAddSanitizers = [
  // Validate and sanitize fields.
  body("product_id").trim().escape(),
  body("variation_volume").trim().escape(),
  body("article").trim().escape(),
  body("isActual").trim().escape(),
  body("barcode").trim().escape(),
];

// Get request for list of all Ozon products
router.get("/ozon", ozon_controller.getProductsListPage);

// Post request for update Ozon stock info of product
router.post("/ozon/update_stock", authMiddleware, ozon_controller.updateStock);

// Get request for list of all Wildberries products
router.get("/wb", wb_controller.getProductsListPage);

// Post request for update Wildberries stock info of product
router.post("/wb/update_stock", authMiddleware, wb_controller.updateApiStock);

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

// Get request for page - add new Marketplace product to DB
router.get("/:marketType/new", productDbController.getDbMarketProductPage);

// Post request for add new Marketplace product to DB
router.post(
  "/:marketType/new",
  roleMiddleware(["ADMIN"]),
  body("sku", "Sku must not be empty.").trim().isLength({ min: 1 }).escape(),
  productAddSanitizers,
  productDbController.addUpdateDbMarketProduct
);

// Get request for page - update Marketplace product to DB
router.get(
  "/:marketType/:product_id",
  productDbController.getDbMarketProductPage
);

// Post request for update new Marketplace product (DB)
router.post(
  "/:marketType/:product_id",
  roleMiddleware(["ADMIN"]),
  body("sku", "Sku must not be empty.").trim().isLength({ min: 1 }).escape(),
  productAddSanitizers,
  productDbController.addUpdateDbMarketProduct
);

module.exports = router;
