import { Yandex } from "../services/yandex.js";

const connectYandexDataResultFormatter = (
  variation,
  yandexDbProduct,
  yandexApiProduct,
  yandexStock
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: yandexDbProduct?._id,
    productSku: yandexApiProduct.shopSku,
    productName:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    productStock: {
      stock: yandexStock,
      updateBy: yandexDbProduct?.sku,
      marketType: "yandex",
    },
  };
};

export const getProductsListPage = (req, res) => {
  Yandex.getProducts(req.query, connectYandexDataResultFormatter)
    .then((products) => {
      // Clear product list of undefined after async
      products = products.filter((product) => !!product);

      // Sorting
      products.sort((product1, product2) =>
        product1.productName.localeCompare(product2.productName, "ru")
      );

      res.render("yandex-stocks", {
        title: "Yandex Stocks",
        marketType: "yandex",
        headers: {
          SKU: { type: "identifier", field: "productSku" },
          Name: { type: "name", field: "productName" },
          FBS: { type: "fbs", field: "productStock" },
        },
        products,
      });
    })
    .catch((error) => {
      console.error(error);
      return res.status(400).json({
        error,
        message: `Error while getting list of products. - ${error.message}`,
      });
    });
};

export const updateApiStock = (req, res) => {
  Yandex.updateApiStock(req.query.sku, req.query.stock)
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        error,
        message: `Error while update api stocks. - ${error.message}`,
      });
    });
};
