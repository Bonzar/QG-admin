import { Ozon } from "../services/ozon.js";

const connectOzonDataResultFormatter = (
  variation,
  ozonDbProduct,
  ozonApiProduct,
  stockFBO,
  stockFBS
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: ozonDbProduct?._id,
    sku: ozonApiProduct.id,
    article: ozonApiProduct.offer_id,
    name:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    stockFBO,
    stockFBS: {
      stock: stockFBS,
      updateBy: ozonApiProduct.offer_id,
      marketType: "ozon",
    },
  };
};

export const getProductsListPage = async (req, res) => {
  try {
    let data = await Ozon.getProducts(
      req.query,
      connectOzonDataResultFormatter
    );

    // Clear product list of undefined after async
    const products = data.filter((product) => !!product);

    // Sorting
    products.sort((product1, product2) =>
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
      products,
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
