import { Woocommerce } from "../services/woocommerce.js";

const connectWooDataResultFormatter = (
  variation,
  wooDbProduct,
  wooApiProduct,
  wooStock
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: wooDbProduct?._id,
    id: wooApiProduct.id,
    name:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    inStock: {
      stock: wooStock,
      updateBy:
        wooApiProduct.type === "simple"
          ? `simple-${wooApiProduct.id}`
          : `variation-${wooApiProduct.id}-${wooDbProduct?.parentVariable.id}`,
      marketType: "woo",
    },
  };
};

export const getProductsList = (req, res) => {
  Woocommerce.getProducts(req.query, connectWooDataResultFormatter)
    .then((products) => {
      // Clear product list of undefined after async
      products = products.filter((product) => !!product);

      // Sorting
      products.sort((product1, product2) =>
        product1.name.localeCompare(product2.name, "ru")
      );

      res.render("woo-stocks", {
        title: "Woo Stocks",
        marketType: "woo",
        headers: {
          ID: { type: "identifier", field: "id" },
          Name: { type: "name", field: "name" },
          FBS: { type: "fbs", field: "inStock" },
        },
        products,
      });
    })
    .catch((error) => {
      console.error(error);
      return res.status(400).json({
        error,
        message: `Error while getting list of products. - ${error}`,
      });
    });
};

export const updateStock = (req, res) => {
  try {
    const [productType, productId, variableId] = req.query.updateBy.split("-");

    Woocommerce.updateApiProduct(
      productId,
      productType,
      {
        stock_quantity: req.query.stock,
      },
      variableId
    )
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        res.status(400).json({
          error,
          message: `Error while updating stock of product. - ${error.message}`,
        });
      });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while updating stock of product. - ${error.message}`,
    });
  }
};
