import { Yandex } from "../services/yandex.js";
import { filterMarketProducts } from "../services/helpers.js";

export const getProductsListPage = (req, res) => {
  Yandex.getProducts()
    .then((products) => {
      const filtratedProducts = filterMarketProducts(
        Object.values(products),
        req.query
      );

      const formattedProducts = filtratedProducts.map((product) => {
        const variation = product.dbInfo?.variation;

        return {
          productInnerId: product.dbInfo?.variation?.product._id,
          marketProductInnerId: product.dbInfo?._id,
          productSku: product.shopSku,
          productName:
            (variation?.product.name ?? "") +
            (["3 мл", "10 мл"].includes(variation?.volume)
              ? ` - ${variation?.volume}`
              : ""),
          productStock: {
            stock: product.fbsStock ?? 0,
            updateBy: product.shopSku,
            marketType: "yandex",
          },
        };
      });

      // Sorting
      formattedProducts.sort((product1, product2) =>
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
        products: formattedProducts,
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
