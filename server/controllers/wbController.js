import { Wildberries } from "../services/wildberries.js";

const connectWbDataResultFormatter = (product) => {
  let { dbVariation, dbProduct, apiProduct, stockFBW, stockFBS } = product;

  return {
    productInnerId: dbVariation?.product._id,
    marketProductInnerId: dbProduct?._id,
    barcode: dbProduct?.barcode ?? "",
    articleWb: apiProduct["nmID"],
    article: apiProduct["vendorCode"],
    name:
      (dbVariation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(dbVariation?.volume)
        ? ` - ${dbVariation?.volume}`
        : ""),
    stockFBW,
    stockFBS: {
      stock: stockFBS,
      updateBy: dbProduct?.barcode ?? "",
      marketType: "wb",
    },
  };
};

export const getProductsListPage = async (req, res) => {
  try {
    let products = await Wildberries.getProducts(req.query);

    let formattedProducts = products.map((product) => {
      return connectWbDataResultFormatter(product);
    });

    // Sorting
    formattedProducts.sort((product1, product2) =>
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
      products: formattedProducts,
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
  Wildberries.updateApiStock(req.query.barcode, req.query.stock)
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
