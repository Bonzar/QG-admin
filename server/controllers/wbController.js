import { Wildberries } from "../services/wildberries.js";
import { filterMarketProducts } from "../services/helpers.js";

export const getProductsListPage = async (req, res) => {
  try {
    const products = await Wildberries.getProducts();

    const filtratedProducts = filterMarketProducts(
      Object.values(products),
      req.query
    );

    const formattedProducts = filtratedProducts.map((product) => {
      return {
        productInnerId: product.dbInfo?.variation?.product._id,
        marketProductInnerId: product.dbInfo?._id,
        barcode: product.dbInfo?.barcode ?? "",
        articleWb: product["nmID"],
        article: product["vendorCode"],
        name:
          (product.dbInfo?.variation?.product.name ?? "") +
          (["3 мл", "10 мл"].includes(product.dbInfo?.variation?.volume)
            ? ` - ${product.dbInfo?.variation?.volume}`
            : ""),
        stockFBW: product.fbmStock ?? 0,
        stockFBS: {
          stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
          updateBy: product.dbInfo?.barcode ?? "",
          marketType: "wb",
        },
      };
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

export const updateStock = (req, res) => {
  try {
    const wbProduct = new Wildberries({ barcode: req.query.barcode });
    wbProduct.updateStock(+req.query.stock).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while update stocks. - ${error.message}`,
    });
  }
};
