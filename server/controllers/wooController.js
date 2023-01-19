import { Woocommerce } from "../services/woocommerce.js";
import { filterMarketProducts } from "../services/helpers.js";

export const getProductsList = (req, res) => {
  Woocommerce.getProducts()
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
          id: product.apiInfo.id,
          name:
            (variation?.product.name ?? "") +
            (["3 мл", "10 мл"].includes(variation?.volume)
              ? ` - ${variation?.volume}`
              : ""),
          inStock: {
            stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
            updateBy:
              product.apiInfo.type === "simple"
                ? `simple-${product.apiInfo.id}`
                : `variation-${product.apiInfo.id}-${product.apiInfo.parentId}`,
            marketType: "woo",
          },
        };
      });

      // Sorting
      formattedProducts.sort((product1, product2) =>
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
        products: formattedProducts,
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
    // const [productType, productId, variableId] = req.query.updateBy.split("-");
    const [, productId] = req.query.updateBy.split("-");

    const wooProduct = new Woocommerce({ id: productId });
    wooProduct.updateStock(+req.query.stock).then((result) => {
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
