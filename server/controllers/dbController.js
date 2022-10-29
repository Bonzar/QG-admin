const dbService = require("../services/dbService");
const async = require("async");
const { validationResult } = require("express-validator");
const wbService = require("../services/wbService");
const yandexService = require("../services/yandexService");
const ozonService = require("../services/ozonService");
const wooService = require("../services/wooService");

exports.getProductPage = (req, res) => {
  try {
    async.waterfall(
      [
        (callback) => {
          dbService.getProductById(req.params.id, callback);
        },
        (product, callback) => {
          dbService.getAllVariations(
            { product },
            [
              {
                path: "wooProduct",
                populate: { path: "parentVariable" },
              },
              "product yandexProduct wbProduct ozonProduct",
            ],
            (err, variations) => {
              if (err) {
                console.log(err);
                callback(err, null);
                return;
              }

              callback(null, product, variations);
            }
          );
        },
        (product, variations, callback) => {
          const variationStockRequests = variations.map((variation) => {
            return (callback) => {
              try {
                dbService.getVariationProductsStocks(
                  variation._id,
                  (err, results) => {
                    if (err) {
                      console.log(err);
                      callback(err, null);
                      return;
                    }

                    variation = results[0];
                    variation.stocks = results[1];

                    callback(null, variation);
                  }
                );
              } catch (e) {
                console.log(e);
                callback(e, null);
              }
            };
          });

          async.parallel(variationStockRequests, (err, variations) => {
            if (err) {
              console.log(err);
              callback(err, null);
              return;
            }

            callback(null, [product, variations]);
          });
        },
      ],
      async (err, results) => {
        if (err) {
          console.log(err);
          res.status(400).json({
            message: `Error while getting product page. Try again later.`,
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        const [product, variations] = results;

        variations.sort((variation1, variation2) => {
          const volumeSortRating = {
            "3 мл": 50,
            "6 мл": 40,
            "10 мл": 30,
            Набор: 20,
            Стикеры: 10,
          };

          return (
            volumeSortRating[variation2.volume] -
            volumeSortRating[variation1.volume]
          );
        });

        if (product) {
          res.render("product", {
            title: `${product.name}`,
            product,
            variations,
          });
        } else {
          res.render("product", {
            title: "Добавить новый товар",
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting all products. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getDbMarketProductPage = async (req, res) => {
  try {
    let allProducts = await dbService.getAllProducts();

    allProducts.sort((product1, product2) =>
      product1.name.localeCompare(product2.name, "ru")
    );

    const marketType = req.params.marketType;
    const productId = req.params.product_id;

    let wooVariableProducts = null;
    if (marketType === "woo") {
      wooVariableProducts = await dbService.getWooVariableProducts({});
      wooVariableProducts.sort(
        (wooVariableProduct1, wooVariableProduct2) =>
          wooVariableProduct1.id - wooVariableProduct2.id
      );
    }

    if (["yandex", "wb", "ozon", "woo"].includes(marketType)) {
      // if id exist -> update product ELSE add new
      if (productId) {
        let marketProduct = null;
        let fbsStocks = null;
        switch (marketType) {
          case "wb":
            marketProduct = (
              await dbService.getWbProducts({ _id: productId })
            )[0];
            fbsStocks =
              (await wbService.getApiProductFbsStocks(marketProduct.barcode))
                .stocks?.[0].stock ?? 0;

            break;
          case "yandex":
            marketProduct = (
              await dbService.getYandexProducts({ _id: productId })
            )[0];
            fbsStocks = (
              await yandexService.getApiProductsList([marketProduct.sku])
            )[0].warehouses?.[0].stocks.find(
              (stockType) => stockType.type === "FIT"
            )?.count;

            break;
          case "ozon":
            marketProduct = (
              await dbService.getOzonProducts({ _id: productId })
            )[0];
            fbsStocks = (
              await ozonService.getProductsStockList({
                product_id: [marketProduct.sku],
                visibility: "ALL",
              })
            ).result.items[0].stocks[1]?.present;

            break;
          case "woo":
            marketProduct = (
              await dbService.getWooProducts(
                { _id: productId },
                "parentVariable"
              )
            )[0];

            switch (marketProduct.type) {
              case "simple":
                fbsStocks = (await wooService.getProductInfo(marketProduct.id))
                  .stock_quantity;
                break;
              case "variation":
                fbsStocks = (
                  await wooService.getProductVariationInfo(
                    marketProduct.parentVariable.id,
                    marketProduct.id
                  )
                ).stock_quantity;
                break;
            }
            break;
        }

        const variationFilter = {};
        variationFilter[`${marketType}Product`] = marketProduct;

        const variation = (
          await dbService.getAllVariations(variationFilter, ["product"])
        )[0];

        if (marketProduct) {
          res.render("marketProduct", {
            title: `${
              marketType[0].toUpperCase() + marketType.slice(1).toLowerCase()
            } - ${
              marketProduct.article ??
              marketProduct.sku ??
              marketProduct.id ??
              marketProduct._id
            } (БД)`,
            marketType,
            allProducts,
            marketProduct,
            variation,
            fbsStocks,
            wooVariableProducts,
          });
        }
      } else {
        res.render("marketProduct", {
          title: `Добавить новый товар ${
            marketType[0].toUpperCase() + marketType.slice(1).toLowerCase()
          } (БД)`,
          marketType,
          allProducts,
          wooVariableProducts,
        });
      }
    } else {
      res.status(400).json({
        message: "Выбран не вырный маркетплейс.",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting market product add page. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getWooProductVariablePage = async (req, res) => {
  try {
    const wooProductVariable = (
      await dbService.getWooVariableProducts({ _id: req.params.id })
    )[0];

    if (wooProductVariable) {
      res.render("wooProductVariable", {
        title: `Woo Variable - ${wooProductVariable.id}`,
        wooProductVariable,
      });
    } else {
      res.render("wooProductVariable", {
        title: "Добавить новый вариативный товар Woo",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting page. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addUpdateDbMarketProduct = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.addUpdateMarketProduct(req.body, (err, results) => {
      if (err) {
        console.log(err);

        if (err.code === 11000) {
          err.message = `Продукт с ${Object.keys(err.keyValue)[0]} - ${
            err.keyValue[Object.keys(err.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({
          message: "Error while adding product to DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json({ marketType: req.body.marketType, results });
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addUpdateDbProduct = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.addUpdateProduct(req.body, (err, results) => {
      if (err) {
        console.log(err);

        if (err.code === 11000) {
          err.message = `Продукт с ${Object.keys(err.keyValue)[0]} - ${
            err.keyValue[Object.keys(err.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({
          message: "Error while adding product to DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addUpdateWooProductVariable = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.addUpdateWooProductVariable(
      req.body._id,
      req.body.id,
      (err, results) => {
        if (err) {
          console.log(err);

          if (err.code === 11000) {
            err.message = `Woo Product Variable с ${
              Object.keys(err.keyValue)[0]
            } - ${err.keyValue[Object.keys(err.keyValue)[0]]} уже существует`;
          }
          res.status(400).json({
            message:
              "Error while adding/update Woo Product Variable to DB. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        res.json(results);
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message:
        "Error while adding/update Woo Product Variable to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.deleteWooProductVariable = async (req, res) => {
  try {
    await dbService.deleteWooProductVariable(req.params.id, (err, results) => {
      if (err) {
        console.log(err);
        res.status(400).json({
          message: "Error while deleting Product from DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message:
        "Error while deleting Woo Product Variable from DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addDbProductVariation = async (req, res) => {
  try {
    await dbService.addProductVariation(req.body, (err, results) => {
      if (err) {
        console.log(err);

        if (err.code === 11000) {
          err.message = `Вариация с ${Object.keys(err.keyValue)[0]} - ${
            err.keyValue[Object.keys(err.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({
          message: "Error while adding variation to DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while adding variation to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.deleteDbProduct = async (req, res) => {
  try {
    await dbService.deleteProduct(req.params.id, (err, results) => {
      if (err) {
        console.log(err);
        res.status(400).json({
          message: "Error while deleting Product from DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while deleting Product from DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.deleteDbProductVariation = async (req, res) => {
  try {
    await dbService.deleteProductVariation(req.params.id, (err, results) => {
      if (err) {
        console.log(err);

        res.status(400).json({
          message: "Error while deleting product variation. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message:
        "Error while deleting product variation from DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.deleteDbMarketProduct = async (req, res) => {
  try {
    await dbService.deleteMarketProduct(
      req.params.marketType,
      req.params._id,
      (err, results) => {
        if (err) {
          console.log(err);

          res.status(400).json({
            message: "Error while deleting market product. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        res.json(results);
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while deleting market product from DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getAllProductsPage = (req, res) => {
  try {
    async.parallel(
      {
        allProducts(callback) {
          dbService.getAllProducts(callback);
        },
      },
      async (err, results) => {
        if (err) {
          console.log(err);
          res.status(400).json({
            message: "Error while getting product page. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        const { allProducts } = results;

        let filtratedProducts;
        // Filtration by actual (manual setup in DB)
        switch (req.query.isActual) {
          case "notActual":
            filtratedProducts = allProducts.filter(
              (product) => !product.isActual
            );
            break;
          case "all":
            filtratedProducts = allProducts;
            break;
          // Only actual by default
          default:
            filtratedProducts = allProducts.filter(
              (product) => product.isActual
            );
        }

        filtratedProducts.sort((product1, product2) =>
          product1.name.localeCompare(product2.name, "ru")
        );

        const products = filtratedProducts.map((product) => {
          product.productInnerId = product._id;
          return product;
        });

        res.render("allProductsPage", {
          title: `Все продукты (БД)`,
          headers: {
            Name: { type: "name", field: "name" },
          },
          products,
        });
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting all products page",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getAllWooProductVariablesPage = (req, res) => {
  try {
    async.parallel(
      {
        allWooVariableProducts(callback) {
          dbService.getWooVariableProducts({}, callback);
        },
      },
      async (err, results) => {
        if (err) {
          console.log(err);
          res.status(400).json({
            message: "Error while getting page. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        const { allWooVariableProducts } = results;

        allWooVariableProducts.sort(
          (wooVariableProduct1, wooVariableProduct2) =>
            wooVariableProduct1.id - wooVariableProduct2.id
        );

        res.render("allWooProductVariables", {
          title: `Woo Variables`,
          wooVariableProducts: allWooVariableProducts,
        });
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting page",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getAllProductsStockPage = async (req, res) => {
  try {
    let allVariationsStockList = [];

    const connectYandexDataResultFormatter = (
      variation,
      yandexDbProduct,
      yandexApiProduct,
      yandexStock
    ) => {
      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation._id &&
          variationStock.yandexStock === undefined
      );

      if (variationStock) {
        variationStock.yandexStock = {
          stock: yandexStock,
          updateBy: yandexDbProduct.sku,
          marketType: "yandex",
        };
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id,
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName:
            (variation?.product.name ?? "") +
            (["3 мл", "10 мл"].includes(variation?.volume)
              ? ` - ${variation?.volume}`
              : ""),
          yandexStock: {
            stock: yandexStock,
            updateBy: yandexDbProduct.sku,
            marketType: "yandex",
          },
        });
      }
    };

    const connectWooDataResultFormatter = (
      variation,
      wooDbProduct,
      wooApiProduct,
      wooStock
    ) => {
      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation._id &&
          variationStock.wooStock === undefined
      );

      if (variationStock) {
        variationStock.wooStock = {
          stock: wooStock,
          updateBy:
            wooApiProduct.type === "simple"
              ? `simple-${wooApiProduct.id}`
              : `variation-${wooDbProduct?.parentVariable.id}-${wooApiProduct.id}`,
          marketType: "woo",
        };
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id,
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName:
            (variation?.product.name ?? "") +
            (["3 мл", "10 мл"].includes(variation?.volume)
              ? ` - ${variation?.volume}`
              : ""),
          wooStock: {
            stock: wooStock,
            updateBy:
              wooApiProduct.type === "simple"
                ? `simple-${wooApiProduct.id}`
                : `variation-${wooDbProduct?.parentVariable.id}-${wooApiProduct.id}`,
            marketType: "woo",
          },
        });
      }
    };

    const connectWbDataResultFormatter = (
      variation,
      wbDbProduct,
      wbApiProduct,
      stockFBW,
      stockFBS
    ) => {
      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation?._id &&
          variationStock.wbStock === undefined &&
          variationStock.FBW === undefined
      );

      if (variationStock) {
        variationStock.wbStock = {
          stock: stockFBS,
          updateBy: wbDbProduct?.barcode ?? "",
          marketType: "wb",
        };

        variationStock.FBW = stockFBW;
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id,
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName:
            (variation?.product.name ?? "") +
            (["3 мл", "10 мл"].includes(variation?.volume)
              ? ` - ${variation?.volume}`
              : ""),
          wbStock: {
            stock: stockFBS,
            updateBy: wbDbProduct?.barcode ?? "",
            marketType: "wb",
          },
          FBW: stockFBW,
        });
      }
    };

    const connectOzonDataResultFormatter = (
      variation,
      ozonDbProduct,
      ozonApiProduct,
      stockFBO,
      stockFBS
    ) => {
      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation._id &&
          variationStock.ozonStock === undefined &&
          variationStock.FBO === undefined
      );

      if (variationStock) {
        variationStock.ozonStock = {
          stock: stockFBS,
          updateBy: ozonApiProduct.offer_id,
          marketType: "ozon",
        };

        variationStock.FBO = stockFBO;
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id,
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName:
            (variation?.product.name ?? "") +
            (["3 мл", "10 мл"].includes(variation?.volume)
              ? ` - ${variation?.volume}`
              : ""),
          ozonStock: {
            stock: stockFBS,
            updateBy: ozonApiProduct.offer_id,
            marketType: "ozon",
          },
          FBO: stockFBO,
        });
      }
    };

    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // Yandex products
              yandexApiProducts(callback) {
                yandexService.getApiProductsList([], callback);
              },
              // Ozon products
              ozonApiProductsInfo(callback) {
                ozonService.getApiProductsList({ visibility: "ALL" }, callback);
              },
              // Woo products
              wooApiProducts(callback) {
                wooService.getProductList("", callback);
              },
              // Wb products
              wbApiProducts(callback) {
                wbService.getApiProductsInfoList(null, callback);
              },
              // Wb Stocks on our warehouse
              wbApiFbsStocks(callback) {
                wbService.getApiProductFbsStocks("", callback);
              },
              // Wb Stocks on Wb warehouse
              wbApiFbwStocks(callback) {
                wbService.getApiProductFbwStocks(callback);
              },
              // List of all products from DB with reference of Yandex product sku to product name
              allDbVariations(callback) {
                dbService.getAllVariations(
                  {},
                  [
                    {
                      path: "wooProduct",
                      populate: { path: "parentVariable" },
                    },
                    "product yandexProduct ozonProduct wbProduct",
                  ],
                  callback
                );
              },
            },
            cb
          );
        },

        (results, cb) => {
          const {
            allDbVariations,
            yandexApiProducts,
            wooApiProducts,
            ozonApiProductsInfo,
            wbApiProducts,
            wbApiFbwStocks,
            wbApiFbsStocks,
          } = results;

          const yandexProductConnectRequests =
            yandexService.getConnectYandexDataRequests(
              req.query,
              yandexApiProducts,
              allDbVariations,
              connectYandexDataResultFormatter
            );

          const wbProductConnectRequests = wbService.getConnectWbDataRequests(
            req.query,
            wbApiProducts,
            wbApiFbsStocks,
            wbApiFbwStocks,
            allDbVariations,
            connectWbDataResultFormatter
          );

          const wooProductConnectRequests =
            wooService.getConnectWooDataRequests(
              req.query,
              wooApiProducts,
              allDbVariations,
              connectWooDataResultFormatter
            );

          const {
            productsInfo: ozonApiProducts,
            productsStockList: ozonApiStocks,
          } = ozonApiProductsInfo;
          const ozonProductConnectRequests =
            ozonService.getConnectOzonDataRequests(
              req.query,
              ozonApiProducts,
              ozonApiStocks,
              allDbVariations,
              connectOzonDataResultFormatter
            );

          async.parallel(
            [
              (callback) => {
                async.parallel(yandexProductConnectRequests, callback);
              },
              (callback) => {
                async.parallel(ozonProductConnectRequests, callback);
              },
              (callback) => {
                async.parallel(wbProductConnectRequests, callback);
              },
              (callback) => {
                async.parallel(wooProductConnectRequests, callback);
              },
            ],
            cb
          );
        },
      ],
      (err) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            message: "Error while getting list of products. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
        }

        // Clear product list of undefined after async
        allVariationsStockList = allVariationsStockList.filter(
          (variation) => !!variation
        );

        // Sorting
        allVariationsStockList.sort((variation1, variation2) =>
          variation1.productName.localeCompare(variation2.productName, "ru")
        );

        res.render("allVariationsStock", {
          title: "All Stocks",
          headers: {
            Name: { type: "name", field: "productName" },
            Yand: { type: "fbs", field: "yandexStock" },
            Ozon: { type: "fbs", field: "ozonStock" },
            FBO: { type: "fbm", field: "FBO" },
            WB: { type: "fbs", field: "wbStock" },
            FBW: { type: "fbm", field: "FBW" },
            Woo: { type: "fbs", field: "wooStock" },
          },
          splitTablesBy: "volume",
          products: allVariationsStockList,
        });
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message:
        "Error while getting all variations stock page. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};
