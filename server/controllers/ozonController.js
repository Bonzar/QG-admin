import { Ozon } from "../services/ozon.js";
import { filterMarketProducts } from "../services/helpers.js";

export const getProductsListPage = async (req, res) => {
  try {
    const products = await Ozon.getProducts();

    const filtratedProducts = filterMarketProducts(
      Object.values(products),
      req.query
    );

    const formattedProducts = filtratedProducts.map((apiProduct) => {
      return {
        productInnerId: apiProduct.dbInfo?.variation?.product._id,
        marketProductInnerId: apiProduct.dbInfo?._id,
        sku: apiProduct.id,
        article: apiProduct.offer_id,
        name:
          (apiProduct.dbInfo?.variation?.product.name ?? "") +
          (["3 мл", "10 мл"].includes(apiProduct.dbInfo?.variation?.volume)
            ? ` - ${apiProduct.dbInfo?.variation?.volume}`
            : ""),
        stockFBO: apiProduct.fbmStock ?? 0,
        stockFBS: {
          stock: apiProduct.fbsStock ?? 0,
          updateBy: apiProduct.offer_id,
          marketType: "ozon",
        },
      };
    });

    // Sorting
    formattedProducts.sort((product1, product2) =>
      product1.name.localeCompare(product2.name, "ru")
    );

    res.render("ozon-stocks", {
      title: "Ozon stocks",
      marketType: "ozon",
      headers: {
        Article: { type: "identifier", field: "article" },
        Name: { type: "name", field: "name" },
        FBM: { type: "fbm", field: "stockFBO" },
        FBS: { type: "fbs", field: "stockFBS" },
      },
      products: formattedProducts,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      error,
      message: `Error while getting list of products. - ${error.message}`,
    });
  }
};

export const updateStock = (req, res) => {
  Ozon.updateApiStock(req.query.id, req.query.stock)
    .then((result) => res.json(result))
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        error,
        message: `Error while updating product stock. - ${error.message}`,
      });
    });
};
