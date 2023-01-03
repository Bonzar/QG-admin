import async from "async";
import { validationResult } from "express-validator";
import * as dbService from "../services/dbService.js";
import * as yandexService from "../services/yandexService.js";
import * as wooService from "../services/wooService.js";
import { Ozon } from "../services/ozon.js";
import { Wildberries } from "../services/wildberries.js";

const isValidationPass = (req, res) => {
  let errors = validationResult(req);

  if (!errors.isEmpty()) {
    // There are errors.
    console.log(errors);
    const message = errors.errors.map((error) => error.msg).join(". ");
    res.status(400).json({ errors, message });
    return false;
  }

  return true;
};

export const getProductPage = (req, res) => {
  try {
    async.waterfall(
      [
        (callback) => {
          dbService
            .getProductById(req.params.id)
            .then((product) => callback(null, product))
            .catch((error) => callback(error, null));
        },
        (product, callback) => {
          dbService
            .getAllVariations({ product }, [
              {
                path: "wooProduct",
                populate: { path: "parentVariable" },
              },
              "product yandexProduct wbProduct ozonProduct",
            ])
            .then((variations) => callback(null, product, variations))
            .catch((error) => callback(error, null));
        },
        (product, variations, callback) => {
          const variationStockRequests = variations.map((variation) => {
            return (callback) => {
              dbService
                .getVariationProductsStocks(variation._id)
                .then((results) => {
                  variation = results[0];
                  variation.stocks = results[1];

                  callback(null, variation);
                })
                .catch((error) => {
                  console.error(error);
                  callback(error, null);
                });
            };
          });

          async
            .parallel(variationStockRequests)
            .then((variations) => {
              callback(null, [product, variations]);
            })
            .catch((error) => {
              console.error(error);
              callback(error, null);
            });
        },
      ],
      (err, results) => {
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

export const getDbMarketProductPage = async (req, res) => {
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
            // eslint-disable-next-line no-case-declarations
            const wbProduct = new Wildberries(productId);
            marketProduct = await wbProduct.getDbData();
            fbsStocks = (await wbProduct.getApiFbsStock()) ?? 0;
            break;
          case "yandex":
            marketProduct = (
              await dbService.getYandexProducts({ _id: productId })
            )[0];
            fbsStocks =
              (
                await yandexService.getApiProductsList([marketProduct.sku])
              )[0].warehouses?.[0].stocks.find(
                (stockType) => stockType.type === "FIT"
              )?.count ?? 0;

            break;
          case "ozon":
            // eslint-disable-next-line no-case-declarations
            const ozonProduct = new Ozon(productId);
            marketProduct = await ozonProduct.getDbData();
            // eslint-disable-next-line no-case-declarations
            const ozonStocks = await ozonProduct.getApiStocks();
            // eslint-disable-next-line no-case-declarations
            const ozonFbsStocks = ozonStocks.find(
              (stock) => stock.type === "fbs"
            );
            fbsStocks = ozonFbsStocks?.present - ozonFbsStocks?.reserved ?? 0;

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

export const getWooProductVariablePage = async (req, res) => {
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

export const addUpdateDbMarketProduct = (req, res) => {
  try {
    if (!isValidationPass(req, res)) {
      return;
    }

    dbService
      .addUpdateMarketProduct(req.body)
      .then((results) => {
        res.json({ marketType: req.body.marketType, results });
      })
      .catch((error) => {
        console.error(error);
        if (error.code === 11000) {
          error.message = `Продукт с ${Object.keys(error.keyValue)[0]} - ${
            error.keyValue[Object.keys(error.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({ error, message: error.message });
      });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while add/update DB market product. – ${error.message}`,
    });
  }
};

export const addUpdateDbProduct = (req, res) => {
  try {
    if (!isValidationPass(req, res)) {
      return;
    }

    dbService
      .addUpdateProduct(req.body)
      .then((results) => {
        res.json(results);
      })
      .catch((error) => {
        console.error(error);

        if (error.code === 11000) {
          error.message = `Продукт с ${Object.keys(error.keyValue)[0]} - ${
            error.keyValue[Object.keys(error.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({ error, message: error.message });
      });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while add/update DB product. – ${error.message}`,
    });
  }
};

export const addUpdateWooProductVariable = (req, res) => {
  try {
    if (!isValidationPass(req, res)) {
      return;
    }

    dbService
      .addUpdateWooProductVariable(req.body._id, req.body.id)
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        console.error(error);
        res.status(400).json({ error, message: error.message });
      });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while add/update DB Woo Product Variable. – ${error.message}`,
    });
  }
};

export const deleteWooProductVariable = (req, res) => {
  try {
    dbService
      .deleteWooProductVariable(req.params.id)
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        console.error(error);
        res.status(400).json({ error, message: error.message });
      });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while deleting Woo Product Variable from DB. – ${error.message}`,
    });
  }
};

export const addDbProductVariation = (req, res) => {
  try {
    dbService
      .addProductVariation(req.body)
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        console.error(error);

        if (error.code === 11000) {
          error.message = `Вариация с ${Object.keys(error.keyValue)[0]} - ${
            error.keyValue[Object.keys(error.keyValue)[0]]
          } уже существует`;
        }

        res.status(400).json({ error, message: error.message });
      });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while adding variation to DB. – ${error.message}`,
    });
  }
};

export const deleteDbProduct = (req, res) => {
  dbService
    .deleteProduct(req.params.id)
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        error,
        message: `Error while deleting product from DB. – ${error.message}`,
      });
    });
};

export const deleteDbProductVariation = (req, res) => {
  dbService
    .deleteProductVariation(req.params.id)
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        error,
        message: `Error while deleting product variation from DB. – ${error.message}`,
      });
    });
};

export const deleteDbMarketProduct = (req, res) => {
  dbService
    .deleteMarketProduct(req.params.marketType, req.params._id)
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        error,
        message: `Error while deleting market product from DB. – ${error.message}`,
      });
    });
};

export const getAllProductsPage = (req, res) => {
  try {
    async.parallel(
      {
        allProducts(callback) {
          dbService
            .getAllProducts()
            .then((products) => callback(null, products))
            .catch((error) => callback(error, null));
        },
      },
      (error, results) => {
        if (error) {
          console.error(error);
          res.status(400).json({
            error,
            message: `Error while getting product page. – ${error.message}`,
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
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while getting all products page. – ${error.message}`,
    });
  }
};

export const getAllWooProductVariablesPage = async (req, res) => {
  try {
    const allWooVariableProducts = await dbService.getWooProducts(
      {},
      "parentVariable"
    );

    allWooVariableProducts.sort(
      (wooVariableProduct1, wooVariableProduct2) =>
        wooVariableProduct1.id - wooVariableProduct2.id
    );

    res.render("allWooProductVariables", {
      title: `Woo Variables`,
      wooVariableProducts: allWooVariableProducts,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while getting All Woo Variables page. – ${error.message}`,
    });
  }
};

export const getAllProductsStockPage = async (req, res) => {
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
          variationStock.variationInnerId === variation?._id &&
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
            updateBy: yandexDbProduct?.sku,
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
              : `variation-${wooApiProduct.id}-${wooDbProduct?.parentVariable.id}`,
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
                : `variation-${wooApiProduct.id}-${wooDbProduct?.parentVariable.id}`,
            marketType: "woo",
          },
        });
      }
    };

    const connectWbDataResultFormatter = (product) => {
      const {
        dbVariation: variation,
        dbProduct: wbDbProduct,
        stockFBW,
        stockFBS,
      } = product;

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
                yandexService
                  .getApiProductsList()
                  .then((result) => callback(null, result))
                  .catch((error) => callback(error, null));
              },
              // List of yandex products from DB
              yandexDbProducts(callback) {
                dbService
                  .getYandexProducts({})
                  .then((products) => callback(null, products))
                  .catch((error) => callback(error, null));
              },
              // Woo products
              wooApiProducts(callback) {
                wooService
                  .getProductList("")
                  .then((products) => callback(null, products))
                  .catch((error) => callback(error, null));
              },
              // List of Woo products from DB
              wooDbProducts(callback) {
                dbService
                  .getWooProducts({}, "parentVariable")
                  .then((products) => callback(null, products))
                  .catch((error) => callback(error, null));
              },
              allDbVariations(callback) {
                dbService
                  .getAllVariations({}, [
                    {
                      path: "wooProduct",
                      populate: { path: "parentVariable" },
                    },
                    "product yandexProduct ozonProduct wbProduct",
                  ])
                  .then((variations) => callback(null, variations))
                  .catch((error) => callback(error, null));
              },
            },
            cb
          );
        },
        (results, cb) => {
          const {
            allDbVariations,
            yandexApiProducts,
            yandexDbProducts,
            wooApiProducts,
            wooDbProducts,
          } = results;

          const yandexProductConnectRequests =
            yandexService.getConnectYandexDataRequests(
              req.query,
              yandexApiProducts,
              yandexDbProducts,
              allDbVariations,
              connectYandexDataResultFormatter
            );

          const wooProductConnectRequests =
            wooService.getConnectWooDataRequests(
              req.query,
              wooApiProducts,
              wooDbProducts,
              allDbVariations,
              connectWooDataResultFormatter
            );

          async.parallel(
            [
              (callback) => {
                async.parallel(yandexProductConnectRequests, callback);
              },
              (callback) => {
                Ozon.getProducts(
                  req.query,
                  connectOzonDataResultFormatter,
                  allDbVariations
                )
                  .then((result) => callback(null, result))
                  .catch((error) => callback(error, null));
              },
              (callback) => {
                Wildberries.getProducts(req.query, allDbVariations)
                  .then((products) =>
                    callback(
                      null,
                      products.map((product) =>
                        connectWbDataResultFormatter(product)
                      )
                    )
                  )
                  .catch((error) => callback(error, null));
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

        const splitTables = {};
        allVariationsStockList.forEach((variation) => {
          if (!variation.volume) return;
          if (!splitTables[variation.volume]) {
            splitTables[variation.volume] = [];
          }

          splitTables[variation.volume].push(variation);
        });

        const tablesArray = Object.keys(splitTables).map((tableName) => ({
          tableName,
          products: splitTables[tableName],
        }));

        const volumeSortRating = {
          "3 мл": 50,
          "6 мл": 40,
          "10 мл": 30,
          Набор: 20,
          Стикеры: 10,
        };
        tablesArray.sort(
          (table1, table2) =>
            volumeSortRating[table2.tableName] -
            volumeSortRating[table1.tableName]
        );

        res.render("allVariationsStock", {
          title: "Все остатки",
          headers: {
            Name: { type: "name", field: "productName" },
            Yand: { type: "fbs", field: "yandexStock" },
            FBO: { type: "fbm", field: "FBO" },
            Ozon: { type: "fbs", field: "ozonStock" },
            FBW: { type: "fbm", field: "FBW" },
            WB: { type: "fbs", field: "wbStock" },
            Woo: { type: "fbs", field: "wooStock" },
          },
          tables: tablesArray,
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
