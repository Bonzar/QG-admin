import express from "express";
import * as ozon_controller from "../controllers/ozonController.js";
import * as wb_controller from "../controllers/wbController.js";
import * as yandex_controller from "../controllers/yandexController.js";
import * as woocommerce_controller from "../controllers/wooController.js";
import * as dbController from "../controllers/dbController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";
import { body } from "express-validator";

const router = express.Router();

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

// Get request for list of all variations stock
router.get("/all", dbController.getAllProductsStockPage);

// Get request for list of all Yandex products
router.get("/yandex", yandex_controller.getProductsListPage);

// Post request for update Yandex stock info of product
router.post(
  "/yandex/update_stock",
  authMiddleware,
  yandex_controller.updateStock
);

// const productAddSanitizers = [
//   // Validate and sanitize fields.
//   body("product_id").trim().escape(),
//   body("variation_volume").trim().escape(),
//   body("article").trim().escape(),
//   body("isActual").trim().escape(),
//   body("barcode").trim().escape(),
// ];

// Get request for list of all Ozon products
router.get("/ozon", ozon_controller.getProductsListPage);

// Post request for update Ozon stock info of product
router.post("/ozon/update_stock", authMiddleware, ozon_controller.updateStock);

// Get request for list of all Wildberries products
router.get("/wb", wb_controller.getProductsListPage);

// Post request for update Wildberries stock info of product
router.post("/wb/update_stock", authMiddleware, wb_controller.updateStock);

// Get request for list of all Woo products
router.get("/woo", woocommerce_controller.getProductsList);

// Post request for update Woo stock info of product
router.post(
  "/woo/update_stock",
  authMiddleware,
  woocommerce_controller.updateStock
);

// Get request for list of all DB products
router.get("/db/products", dbController.getAllProductsPage);

// Get request for list of all DB products
router.get("/db/variations", dbController.getAllVariationsPage);

// Post request for update variation stocks
router.post(
  "/db/variation/updateStock",
  roleMiddleware(["ADMIN"]),
  dbController.updateVariationStock
);

// Post request for redistribute all variations stocks
router.post(
  "/db/variation/redistributeStock",
  roleMiddleware(["ADMIN"]),
  dbController.redistributeVariationsStock
);

// Get request for add new DB product page
router.get("/db/product/new", dbController.getProductPage);

// Post request for add new DB product to DB
router.post(
  "/db/product/new",
  roleMiddleware(["ADMIN"]),
  body("name", "Name must not be empty.").trim().isLength({ min: 1 }).escape(),
  dbController.addUpdateDbProduct
);

// Post request for delete Product to DB
router.post(
  "/db/product/:id/delete",
  roleMiddleware(["ADMIN"]),
  dbController.deleteDbProduct
);

// Post request for add Variation to DB
router.post(
  "/db/variation/new",
  roleMiddleware(["ADMIN"]),
  dbController.addDbProductVariation
);

// Post request for delete Variation to DB
router.post(
  "/db/variation/:id/delete",
  roleMiddleware(["ADMIN"]),
  dbController.deleteDbProductVariation
);

// Get request for DB product page
router.get("/db/product/:id", dbController.getProductPage);

// Post request for add/update new Marketplace product to DB
router.post(
  "/db/product/:id",
  roleMiddleware(["ADMIN"]),
  body("name", "Name must not be empty.").trim().isLength({ min: 1 }).escape(),
  dbController.addUpdateDbProduct
);

// Get request for list of all DB Woo Product Variables Page
router.get("/db/wooVariables", dbController.getAllWooProductVariablesPage);

// Get request for add DB Woo Product Variable Page
router.get("/db/wooVariable/new", dbController.getWooProductVariablePage);

// Get request DB Woo Product Variable Page
router.get("/db/wooVariable/:id", dbController.getWooProductVariablePage);

// Post request for add/update new Woo Product Variable to DB
router.post(
  "/db/wooVariable/:id",
  roleMiddleware(["ADMIN"]),
  body("id", "Id must not be empty.").trim().isLength({ min: 1 }).escape(),
  dbController.addUpdateWooProductVariable
);

// Post request for delete Woo Product Variable to DB
router.post(
  "/db/wooVariable/:id/delete",
  roleMiddleware(["ADMIN"]),
  dbController.deleteWooProductVariable
);

// Get request for page - add new Marketplace product to DB
router.get("/:marketType/new", dbController.getDbMarketProductPage);

// Post request for add new Marketplace product to DB
router.post(
  "/:marketType/new",
  roleMiddleware(["ADMIN"]),
  // body("sku", "Sku must not be empty.").trim().isLength({ min: 1 }).escape(),
  // ...productAddSanitizers,
  dbController.addUpdateDbMarketProduct
);

// Get request for page - update Marketplace product to DB
router.get("/:marketType/:product_id", dbController.getDbMarketProductPage);

// Post request for update new Marketplace product (DB)
router.post(
  "/:marketType/:product_id",
  roleMiddleware(["ADMIN"]),
  // body("sku", "Sku must not be empty.").trim().isLength({ min: 1 }).escape(),
  // ...productAddSanitizers,
  dbController.addUpdateDbMarketProduct
);

// Post request for update new Marketplace product (DB)
router.post(
  "/:marketType/:_id/delete",
  roleMiddleware(["ADMIN"]),
  // ...productAddSanitizers,
  dbController.deleteDbMarketProduct
);

export default router;
