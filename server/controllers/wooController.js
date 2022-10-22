const wooService = require("../services/wooService");
const async = require("async");
const dbService = require("../services/dbService");

const formatProductInfo = (
  product,
  allDbVariations,
  wooDbProducts,
  filtersQuery
) => {
  return (callback) => {
    // Search fetched product from woo in DB
    const wooDbProduct = wooDbProducts.find(
      (wooDbProduct) => wooDbProduct.id === product.id
    );

    const variation = allDbVariations.find(
      (variation) =>
        variation.wooProduct?.filter(
          (wooProduct) => wooProduct.id === product.id
        ).length > 0
    );

    const stock = product["stock_quantity"];

    // Filtration
    let isPassFilterArray = [];
    // by stock status
    switch (filtersQuery.stock_status) {
      // Filter only outofstock products (by FBS)
      case "outofstock":
        isPassFilterArray.push(stock <= 0);
        break;
    }

    // by actual (manual setup in DB)
    switch (filtersQuery.isActual) {
      case "notActual":
        isPassFilterArray.push(wooDbProduct?.isActual === false);
        break;
      case "all":
        isPassFilterArray.push(true);
        break;
      // Only actual by default
      default:
        isPassFilterArray.push(wooDbProduct?.isActual !== false);
    }

    if (isPassFilterArray.every((pass) => pass)) {
      callback(null, {
        variationInnerId: variation?.product._id,
        marketProductInnerId: wooDbProduct?._id,
        id: product.id,
        stock,
        updateBy:
          product.type === "simple"
            ? `simple-${product.id}`
            : `variation-${wooDbProduct.parentVariable.id}-${product.id}`,
        name:
          (variation?.product.name ?? "") +
          (["3 мл", "10 мл"].includes(variation?.volume)
            ? ` - ${variation?.volume}`
            : ""),
      });
    } else {
      callback(null, null);
    }
  };
};

exports.getProductsList = async (req, res) => {
  try {
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
              productsApiList(callback) {
                wooService.getProductList("", callback);
              },
              // List of wb products from DB
              wooDbProducts(callback) {
                dbService.getWooProducts({}, "parentVariable", callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const { productsApiList, wooDbProducts, allDbVariations } = results;

          const productsFormatRequests = [];

          productsApiList.forEach((productApi) => {
            if (productApi.type === "simple") {
              productsFormatRequests.push(
                formatProductInfo(
                  productApi,
                  allDbVariations,
                  wooDbProducts,
                  req.query
                )
              );
            } else {
              for (const variationApi of productApi.product_variations) {
                productsFormatRequests.push(
                  formatProductInfo(
                    variationApi,
                    allDbVariations,
                    wooDbProducts,
                    req.query
                  )
                );
              }
            }
          });

          async.parallel(productsFormatRequests, cb);
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
          headers: {
            ID: "id",
            Name: "name",
            FBS: "stock",
          },
          updateBy: "updateBy",
          products,
        });
      }
    );
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
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
      .catch((e) => {
        console.log(e);
        res.status(500).json(e);
      });
  } catch (e) {
    res
      .status(400)
      .send("Error while updating stock of product. Try again later.");
  }
};
