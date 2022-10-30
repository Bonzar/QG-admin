const wooService = require("../services/wooService");
const async = require("async");
const dbService = require("../services/dbService");

exports.getProductsList = async (req, res) => {
  try {
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
              : `variation-${wooDbProduct?.parentVariable.id}-${wooApiProduct.id}`,
          marketType: "woo",
        },
      };
    };

    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // List of all products from DB with reference of Woo product sku to product name
              allDbVariations(callback) {
                dbService.getAllVariations(
                  {},
                  [
                    {
                      path: "wooProduct",
                      populate: { path: "parentVariable" },
                    },
                    "product",
                  ],
                  callback
                );
              },
              // List of all products fetched from Woo server
              wooApiProducts(callback) {
                wooService.getProductList("", callback);
              },
              // List of Woo products from DB
              wooDbProducts(callback) {
                dbService.getWooProducts({}, "parentVariable", callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const { wooApiProducts, allDbVariations, wooDbProducts } = results;
          async.parallel(
            wooService.getConnectWooDataRequests(
              req.query,
              wooApiProducts,
              wooDbProducts,
              allDbVariations,
              connectWooDataResultFormatter
            ),
            cb
          );
        },
      ],
      (err, products) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            message: "Error while getting list of products. Try again later.",
            err,
          });
        }

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
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting list of products. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getStockUpdateInfo = async (req, res) => {
  try {
    res.json(await wooService.getStockUpdateInfo(req.params.id));
  } catch (e) {
    res
      .status(400)
      .send("Error while getting stock info of product. Try again later.");
  }
};

exports.updateStock = (req, res) => {
  try {
    const [productType, productId, variationId] = req.query.updateBy.split("-");

    wooService
      .updateProduct(productType, productId, variationId, {
        stock_quantity: req.query.stock,
      })
      .then(() => {
        res.send();
      })
      .catch((err) => {
        res.status(400).json({
          message: "Error while updating stock of product. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
      });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while updating stock of product. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};
