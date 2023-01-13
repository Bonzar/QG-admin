import async from "async";
import { validationResult } from "express-validator";
import * as dbService from "../services/dbService.js";
import { Ozon } from "../services/ozon.js";
import { Wildberries } from "../services/wildberries.js";
import { Yandex } from "../services/yandex.js";
import { Woocommerce } from "../services/woocommerce.js";
import {
  filterMarketProducts,
  getMarketplaceClasses,
} from "../services/helpers.js";

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

const getMarketProductRequest = (
  Marketplace,
  marketVariationDbProduct,
  marketType
) => {
  return (callback) => {
    const marketProductInstance = new Marketplace(marketVariationDbProduct._id);
    marketProductInstance
      .getProduct()
      .then((marketProductData) => {
        const reserve = marketProductData.fbsReserve ?? 0;

        marketVariationDbProduct.fbsStock =
          (marketProductData.fbsStock ?? 0) + reserve;
        marketVariationDbProduct.fbsReserve = reserve;
        if (["wb", "ozon"].includes(marketType)) {
          marketVariationDbProduct.fbmStock = marketProductData.fbmStock;
        }

        callback(null, null);
      })
      .catch((error) => callback(error, null));
  };
};

export const getProductPage = (req, res) => {
  dbService
    .getProductById(req.params.id)
    .then(async (product) => {
      const productVariations = await dbService.getProductVariations({
        product: product?._id,
      });

      const productRequests = [];

      // product variations requests
      for (const productVariation of productVariations) {
        const variationDbProductRequests = [];

        // each marketplace requests
        for (const [marketType, Marketplace] of Object.entries(
          getMarketplaceClasses()
        )) {
          productVariation[`${marketType}Products`] =
            await Marketplace.getDbProducts({
              variation: productVariation._id,
            });

          const marketVariationDbProductRequests = [];

          // market products requests
          for (const marketVariationDbProduct of productVariation[
            `${marketType}Products`
          ]) {
            marketVariationDbProductRequests.push(
              getMarketProductRequest(
                Marketplace,
                marketVariationDbProduct,
                marketType
              )
            );
          }

          variationDbProductRequests.push((callback) => {
            async.parallel(marketVariationDbProductRequests, callback);
          });
        }

        productRequests.push((callback) => {
          async.parallel(variationDbProductRequests, callback);
        });
      }

      // wait for data assign complete
      await async.parallel(productRequests);

      productVariations.sort((variation1, variation2) => {
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
          variations: productVariations,
        });
      } else {
        res.render("product", {
          title: "Добавить новый товар",
        });
      }
    })
    .catch((error) => {
      console.log(error);
      res.status(400).json({
        message: "Error while getting all products. Try again later.",
        code: error.code,
        status: error.response?.status,
      });
    });
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
      wooVariableProducts = await Woocommerce.getDbVariableProducts();
      wooVariableProducts.sort(
        (wooVariableProduct1, wooVariableProduct2) =>
          wooVariableProduct1.id - wooVariableProduct2.id
      );
    }
    // if id exist -> update product ELSE add new
    if (productId) {
      const Marketplace = getMarketplaceClasses()[marketType];
      const marketProductInstance = new Marketplace(productId);
      const marketProductData = await marketProductInstance.getProduct();
      const marketProduct = marketProductData.dbInfo;
      const fbsReserve = marketProductData.fbsReserve ?? 0;
      marketProduct.fbsReserve = fbsReserve;
      marketProduct.fbsStock = marketProductData.fbsStock + fbsReserve;

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
      await Woocommerce.getDbVariableProducts({ _id: req.params.id })
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
    const allWooVariableProducts = await Woocommerce.getDbVariableProducts();

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

    const connectYandexDataResultFormatter = (product) => {
      const variation = product.dbInfo?.variation;

      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation?._id.toString() &&
          variationStock.yandexStock === undefined
      );

      if (variationStock) {
        variationStock.yandexStock = {
          stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
          updateBy: product.shopSku,
          marketType: "yandex",
        };
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id.toString(),
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName: variation?.product.name ?? "",
          yandexStock: {
            stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
            updateBy: product.shopSku,
            marketType: "yandex",
          },
        });
      }
    };

    const connectWooDataResultFormatter = (product) => {
      const variation = product.dbInfo?.variation;

      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation._id.toString() &&
          variationStock.wooStock === undefined
      );

      if (variationStock) {
        variationStock.wooStock = {
          stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
          updateBy:
            product.type === "simple"
              ? `simple-${product.id}`
              : `variation-${product.id}-${product.parentId}`,
          marketType: "woo",
        };
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id.toString(),
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName: variation?.product.name ?? "",
          wooStock: {
            stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
            updateBy:
              product.type === "simple"
                ? `simple-${product.id}`
                : `variation-${product.id}-${product.parentId}`,
            marketType: "woo",
          },
        });
      }
    };

    const connectWbDataResultFormatter = (product) => {
      const variation = product.dbInfo?.variation;

      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation?._id.toString() &&
          variationStock.wbStock === undefined &&
          variationStock.FBW === undefined
      );

      if (variationStock) {
        variationStock.wbStock = {
          stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
          updateBy: product.dbInfo?.barcode ?? "",
          marketType: "wb",
        };

        variationStock.FBW = product.fbmStock ?? 0;
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id.toString(),
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName: variation?.product.name ?? "",
          wbStock: {
            stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
            updateBy: product.dbInfo?.barcode ?? "",
            marketType: "wb",
          },
          FBW: product.fbmStock ?? 0,
        });
      }
    };

    const connectOzonDataResultFormatter = (product) => {
      const variation = product.dbInfo?.variation;

      const variationStock = allVariationsStockList.find(
        (variationStock) =>
          variationStock.variationInnerId === variation._id.toString() &&
          variationStock.ozonStock === undefined &&
          variationStock.FBO === undefined
      );

      if (variationStock) {
        variationStock.ozonStock = {
          stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
          updateBy: product.offer_id,
          marketType: "ozon",
        };
        variationStock.FBO = product.fbmStock ?? 0;
      } else {
        allVariationsStockList.push({
          variationInnerId: variation?._id.toString(),
          productInnerId: variation?.product._id,
          volume: variation?.volume,
          productName: variation?.product.name ?? "",
          ozonStock: {
            stock: (product.fbsStock ?? 0) + (product.fbsReserve ?? 0),
            updateBy: product.offer_id,
            marketType: "ozon",
          },
          FBO: product.fbmStock ?? 0,
        });
      }
    };

    await async.parallel([
      (callback) => {
        Yandex.getProducts().then((products) => {
          const filtratedProducts = filterMarketProducts(
            Object.values(products),
            req.query
          );

          callback(
            null,
            filtratedProducts.map((product) =>
              connectYandexDataResultFormatter(product)
            )
          );
        });
      },
      (callback) => {
        Ozon.getProducts().then((products) => {
          const filtratedProducts = filterMarketProducts(
            Object.values(products),
            req.query
          );

          callback(
            null,
            filtratedProducts.map((product) =>
              connectOzonDataResultFormatter(product)
            )
          );
        });
      },
      (callback) => {
        Wildberries.getProducts()
          .then((products) => {
            const filtratedProducts = filterMarketProducts(
              Object.values(products),
              req.query
            );

            callback(
              null,
              filtratedProducts.map((product) =>
                connectWbDataResultFormatter(product)
              )
            );
          })
          .catch((error) => callback(error, null));
      },
      (callback) => {
        Woocommerce.getProducts()
          .then((products) => {
            const filtratedProducts = filterMarketProducts(
              Object.values(products),
              req.query
            );

            callback(
              null,
              filtratedProducts.map((product) =>
                connectWooDataResultFormatter(product)
              )
            );
          })
          .catch((error) => callback(error, null));
      },
    ]);

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
        volumeSortRating[table2.tableName] - volumeSortRating[table1.tableName]
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

export const getAllVariationsPage = async (req, res) => {
  try {
    const allVariations = await dbService.getAllVariations({}, ["product"]);

    allVariations.forEach((variation) => {
      variation.name = variation.product.name;
      variation.productInnerId = variation.product._id;
      variation.variationId = variation._id;
    });

    // Sorting
    allVariations.sort((variation1, variation2) =>
      variation1.name.localeCompare(variation2.name, "ru")
    );

    const splitTables = {};
    allVariations.forEach((variation) => {
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
        volumeSortRating[table2.tableName] - volumeSortRating[table1.tableName]
    );

    res.render("allVariationsPage", {
      title: "Все вариации",
      mainClass: "all-variations-stock-update",
      headers: {
        Name: { type: "name", field: "name" },
      },
      tables: tablesArray,
    });
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

export const updateVariationStock = async (req, res) => {
  try {
    const result = await dbService.updateVariationStock(
      req.body.variationId,
      +req.body.readyStock,
      +req.body.dryStock
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while updating variation stock. - ${error.message}`,
    });
  }
};

export const redistributeVariationsStock = async (req, res) => {
  try {
    const result = await dbService.redistributeVariationsStock();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Error while updating variation stock. - ${error.message}`,
    });
  }
};
