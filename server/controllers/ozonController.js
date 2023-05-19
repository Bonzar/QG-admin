import { Ozon } from "../services/ozon.js";
import { filterMarketProducts } from "../services/helpers.js";

export const getProductsListPage = async (req, res) => {
  try {
    const products = await Ozon.getProducts();

    const filtratedProducts = filterMarketProducts(
      Object.values(products),
      req.query
    );

    const formattedProducts = filtratedProducts.map((product) => {
      return {
        productInnerId: product.dbInfo?.variation?.product._id,
        marketProductInnerId: product.dbInfo?._id,
        sku: product.apiInfo?.id,
        article: product.apiInfo?.offer_id,
        name:
          (product.dbInfo?.variation?.product.name ?? "") +
          (["Набор", "Стикеры"].includes(product.dbInfo?.variation?.volume) ? "" : ` - ${product.dbInfo?.variation?.volume}`),
        stockFBO: product.fbmStock ?? 0,
        stockFBS: {
          stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
          updateBy: product.apiInfo?.offer_id,
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
  try {
    const ozonProduct = new Ozon({ article: req.query.id });
    ozonProduct.updateStock(+req.query.stock).then((result) => {
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
