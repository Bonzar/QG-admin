import async from "async";
import * as wbService from "../services/wbService.js";
import { Wildberries } from "../services/wbService.js";

import * as dbService from "../services/dbService.js";

const connectWbDataResultFormatter = (
  variation,
  wbDbProduct,
  wbApiProduct,
  stockFBW,
  stockFBS
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: wbDbProduct?._id,
    barcode: wbDbProduct?.barcode ?? "",
    articleWb: wbApiProduct["nmID"],
    article: wbApiProduct["vendorCode"],
    name:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    stockFBW,
    stockFBS: {
      stock: stockFBS,
      updateBy: wbDbProduct?.barcode ?? "",
      marketType: "wb",
    },
  };
};

export const getProductsListPage = async (req, res) => {
  try {
    const wb = new Wildberries();

    let products = await wb.getProducts(
      req.query,
      connectWbDataResultFormatter
    );

    products = products.filter((product) => !!product);

    // Sorting
    products.sort((product1, product2) =>
      product1.name.localeCompare(product2.name, "ru")
    );

    res.render("wb-stocks", {
      title: "WB Stocks",
      marketType: "wb",
      headers: {
        Article: { type: "identifier", field: "article" },
        Name: { type: "name", field: "name" },
        FBM: { type: "fbm", field: "stockFBW" },
        FBS: { type: "fbs", field: "stockFBS" },
      },
      products,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while getting list of products. - ${error.message}`,
    });
  }
};

export const updateApiStock = (req, res) => {
  wbService
    .updateApiStock(req.query.barcode, req.query.stock)
    .then((result) => {
      if (result["error"]) {
        return res
          .status(400)
          .json({ message: result["errorText"], result: result });
      }
      res.json(result);
    })
    .catch((err) => {
      console.log(err);
      res.status(400).json({
        message: "Error while updating product stock. Try again later.",
        code: err.code,
        status: err.response?.status,
      });
    });
};
