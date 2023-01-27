import async from "async";

import ProductVariation from "../models/ProductVariation.js";
import Product from "../models/Product.js";
import WbProduct from "../models/WbProduct.js";
import YandexProduct from "../models/YandexProduct.js";
import OzonProduct from "../models/OzonProduct.js";
import WooProduct from "../models/WooProduct.js";
import Sells from "../models/Sells.js";
import WooProductVariable from "../models/WooProductVariable.js";

import { Ozon } from "./ozon.js";
import { Wildberries } from "./wildberries.js";
import { getMarketplaceClasses } from "./helpers.js";

import cron from "node-cron";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "db-service" },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

cron.schedule(
  "30 4 * * 0-6/2",
  () => {
    redistributeFailedVariationsStocksTask.stop();
    redistributeVariationsStock()
      .then((result) => {
        logger.log({
          level: "info",
          date: new Date(),
          message: "Success scheduled redistribute variations stock.",
          result,
        });
      })
      .catch((error) => {
        console.error(error);
        logger.log({
          level: "error",
          date: new Date(),
          message: "Error while scheduled redistribute variations stock.",
          error,
        });
      })
      .finally(() => redistributeFailedVariationsStocksTask.start());
  },
  { scheduled: process.env.NODE_ENV === "production" }
);

const redistributeFailedVariationsStocksTask = cron.schedule(
  "0 * * * *",
  () => {
    redistributeFailedVariations()
      .then((result) => {
        if (result.some((variation) => variation.error)) {
          throw new Error("Redistribute failed");
        }

        logger.log({
          level: "info",
          date: new Date(),
          message: "Success scheduled redistribute failed variations stock.",
          result,
        });
      })
      .catch((error) => {
        console.error(error);
        logger.log({
          level: "error",
          date: new Date(),
          message:
            "Error while scheduled redistribute failed variations stock.",
          error,
        });
      });
  }
);

/**
 * Returns the market products list for given variation
 * @param {string} variationId
 * @returns {Promise[{marketProductInstance, marketProductData: {dbInfo: {}, fbsStock: number, fbmStock: number, fbsReserve: number}}]} Market products for given variation
 */
const getVariationActualMarketProducts = async (variationId) => {
  const marketProductInstances = Object.values(getMarketplaceClasses()).map(
    (Marketplace) => {
      return new Marketplace({
        variation: variationId,
        isActual: true,
      });
    }
  );

  const marketProducts = await async.parallel(
    marketProductInstances.map((marketProductInstance) => {
      return (callback) => {
        marketProductInstance
          .getProduct()
          .then((marketProductData) => {
            callback(null, { marketProductInstance, marketProductData });
          })
          .catch((error) => {
            if (error.code === "NO-DB-DATA") {
              callback(null, null);
              return;
            }

            callback(error, null);
          });
      };
    })
  );

  return marketProducts.filter((marketProduct) => !!marketProduct);
};

export const redistributeVariationStock = (variationId, isProcessFailed) => {
  return getProductVariationById(variationId, ["product"]).then((variation) =>
    redistributeVariationsStock([variation], isProcessFailed)
  );
};

export const redistributeVariationsStock = async (
  variations,
  isProcessFailed
) => {
  if (!(variations?.length > 0) && !isProcessFailed) {
    variations = await getProductVariations({}, "product");
  }

  const variationUpdateRequests = variations.map((variation) => {
    return (callback) => {
      getVariationActualMarketProducts(variation._id)
        .then((marketProducts) => {
          // no need to redistribute with one or zero market product in variation
          if (marketProducts.length <= 1) {
            return null;
          }

          const currentFbsStock = marketProducts.reduce(
            (total, marketProduct) =>
              total +
              (marketProduct.marketProductData.fbsStock ?? 0) +
              (marketProduct.marketProductData.fbsReserve ?? 0),
            0
          );

          return updateVariationStock(
            variation._id,
            !isProcessFailed
              ? currentFbsStock
              : variation.readyStock -
                  (variation.stockOnError - currentFbsStock),
            !isProcessFailed ? 0 : variation.dryStock,
            marketProducts
          );
        })
        .then((result) => {
          callback(null, result);
        })
        .catch((error) => {
          console.error(error);
          callback(null, { error });
        });
    };
  });

  return async.parallelLimit(variationUpdateRequests, 6);
};

export const updateVariationStock = async (
  variationId,
  readyStock,
  dryStock,
  marketProducts
) => {
  if (!marketProducts) {
    marketProducts = await getVariationActualMarketProducts(variationId);
  }

  if (marketProducts.length <= 0) {
    throw new Error("Не найдены продукты для обновления");
  }

  if (isNaN(+readyStock)) {
    throw new Error("Неверно указаны готовые остатки.");
  }

  let allFbsReserve = 0;
  let variation = marketProducts[0].marketProductData.dbInfo.variation;
  variation.readyStock = readyStock;
  variation.dryStock = dryStock;

  marketProducts.forEach((marketProduct) => {
    allFbsReserve += marketProduct.marketProductData.fbsReserve ?? 0;

    marketProduct.fbsReserve = marketProduct.marketProductData.fbsReserve ?? 0;
    marketProduct.fbmStock = marketProduct.marketProductData.fbmStock ?? 0;
    marketProduct.newStock = 0;
  });

  const variationVolumeDryStockCof = {
    "3 мл": 0.6,
    "6 мл": 0.3,
  };

  const allNewStock = Math.trunc(
    readyStock +
      (isNaN(dryStock) ? 0 : dryStock) *
        (variationVolumeDryStockCof[variation.volume] ?? 0)
  );

  const allAvailableStock = allNewStock - allFbsReserve;

  const calculateNewStocks = (availableStocks, marketProducts) => {
    if (availableStocks <= 0) {
      return;
    }

    if (availableStocks < marketProducts.length) {
      marketProducts.forEach((marketProduct) => {
        if (availableStocks > 0 && marketProduct.fbmStock <= 0) {
          marketProduct.newStock++;
          availableStocks--;
        }
      });
      return;
    }

    const stockByMarketplace = Math.trunc(
      availableStocks / marketProducts.length
    );

    availableStocks -= stockByMarketplace * marketProducts.length;

    marketProducts.forEach((marketProduct) => {
      if (marketProduct.fbmStock > 0) {
        const fbmStock = marketProduct.fbmStock;
        if (stockByMarketplace >= fbmStock) {
          const newStock = stockByMarketplace - fbmStock;
          marketProduct.newStock = newStock;
          availableStocks += stockByMarketplace - newStock;
        } else {
          availableStocks += stockByMarketplace;
        }
        marketProduct.fbmStock -= stockByMarketplace;
        return;
      }

      marketProduct.newStock += stockByMarketplace;
    });

    return calculateNewStocks(availableStocks, marketProducts);
  };

  calculateNewStocks(allAvailableStock, marketProducts);

  const updateRequests = {};
  marketProducts.forEach(({ marketProductInstance, fbsReserve, newStock }) => {
    updateRequests[marketProductInstance.constructor.name] = (callback) => {
      let resultStock = newStock + fbsReserve;
      marketProductInstance
        .addUpdateProduct({ stockFBS: resultStock })
        .then((result) => {
          if (!result.updateApiStock.updated) {
            const newErr = new Error(
              `${marketProductInstance.constructor.name} product api stock update failed`
            );
            newErr.classCode = marketProductInstance.constructor.name;
            newErr.data = result.updateApiStock.error;

            throw newErr;
          }

          callback(null, result);
        })
        .catch((error) => {
          callback(error, null);
        });
    };
  });

  return async
    .parallel(updateRequests)
    .then(async (result) => {
      await variation.save(); // saving ready and dry stock
      return result;
    })
    .catch((error) => {
      console.error(error);

      const revertRequests = {};
      marketProducts.forEach(
        ({ marketProductData, marketProductInstance, fbsReserve }) => {
          // skip market product that wasn't update
          if (marketProductInstance.constructor.name === error.classCode) {
            return;
          }

          revertRequests[marketProductInstance.constructor.name] = (
            callback
          ) => {
            let resultStock = (marketProductData.fbsStock ?? 0) + fbsReserve;
            marketProductInstance
              .addUpdateProduct({ stockFBS: resultStock })
              .then((result) => {
                callback(null, result);
              })
              .catch((error) => {
                callback(error, null);
              });
          };
        }
      );

      return async.parallel(revertRequests).then(async (results) => {
        const actualMarketProducts = await getVariationActualMarketProducts(
          variationId
        );

        const isRevertSuccess = Object.values(results).every(
          (product) => product.updateApiStock.updated
        );

        variation.stockUpdateStatus = isRevertSuccess
          ? "update-failed-reverted"
          : "update-failed-revert-failed";
        variation.stockOnError = actualMarketProducts.reduce(
          (total, marketProduct) =>
            total +
            (marketProduct.marketProductData.fbsStock ?? 0) +
            (marketProduct.marketProductData.fbsReserve ?? 0),
          0
        );
        await variation.save();

        const revertResultError = new Error(
          `${
            error.classCode
          } product api stock update failed, all variation products stocks ${
            isRevertSuccess ? "was reverted" : "revert failed"
          }`
        );

        revertResultError.code = isRevertSuccess
          ? "STOCKS-REVERT-SUCCESS"
          : "STOCKS-REVERT-FAILED";
        revertResultError.data = error.data;
        revertResultError.classCode = error.classCode;

        throw revertResultError;
      });
    });
};

export const getProductVariation = (filter, populate) => {
  return ProductVariation.findOne(filter).populate(populate);
};

export const getProductVariations = (filter, populate) => {
  return ProductVariation.find(filter).populate(populate);
};

const populateAll = (query, populates) => {
  for (const populate of populates) {
    query.populate(populate);
  }

  return query;
};

export const getProductVariationById = (id, populates = []) => {
  return populateAll(ProductVariation.findById(id), populates).exec();
};

export const getAllVariations = (filter = {}, populates = []) => {
  return populateAll(ProductVariation.find(filter), populates).exec();
};

export const getProductById = (id) => {
  return Product.findById(id).exec();
};

export const getAllProducts = () => {
  return Product.find().exec();
};

export const getAllSells = (filter = {}, populate = "") => {
  return Sells.find(filter).populate(populate);
};

export const getLastSell = (filter = {}, populate = "") => {
  return Sells.findOne(filter).populate(populate).sort({ date: -1 }).limit(1);
};

/* todo Убрать проверку на наличие записи о продажи в БД
 * Оставить только добавление в базу данных (проверить уникальный ключ)
 * Добавить обработку ошибки в случае добавления повторки
 * Добавить пороговое значение даты для обновления продаж сохраненное с последнего обновления
 **/
export const addUpdateSell = async (sellData, cbFunc) => {
  try {
    let marketProduct;
    switch (sellData.marketProductRef) {
      case "WbProduct":
        marketProduct = await WbProduct.findOne({
          sku: sellData.productIdentifier,
        });
        break;
      case "OzonProduct":
        marketProduct = await OzonProduct.findOne({
          sku: +sellData.productIdentifier,
        });
        break;
      case "YandexProduct":
        marketProduct = await YandexProduct.findOne({
          sku: sellData.productIdentifier,
        });
        break;
      case "WooProduct":
        marketProduct = await WooProduct.findOne({
          id: +sellData.productIdentifier,
        });
        break;
    }

    let sellDetails = {
      marketProductRef: sellData.marketProductRef,
      orderId: sellData.orderId,
      quantity: +sellData.quantity,
      date: new Date(sellData.date),
      marketProduct,
    };

    let sell;
    if (sellData._id) {
      sell = await Sells.findById(sellData._id).exec();
      for (const [key, value] of Object.entries(sellDetails)) {
        sell[key] = value;
      }
    } else {
      sell = new Sells(sellDetails);
    }

    sell.save((err) => {
      if (err) {
        console.log(err);
        cbFunc(err, null);
        return;
      }

      console.log(`Sell ${sellDetails.orderId} saved.`);
      cbFunc(null, sell);
    });
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

export const addUpdateWooProductVariable = (oldId = null, newId) => {
  let wooProductVariableDetails = {
    id: +newId,
  };

  return WooProductVariable.findById(oldId)
    .exec()
    .then((wooProductVariable) => {
      if (!wooProductVariable) {
        wooProductVariable = new WooProductVariable(wooProductVariableDetails);
      }

      for (const [key, value] of Object.entries(wooProductVariableDetails)) {
        wooProductVariable[key] = value;
      }

      return wooProductVariable.save();
    });
};

export const deleteWooProductVariable = (id) => {
  return WooProductVariable.findById(id)
    .exec()
    .then((wooProductVariable) => {
      if (!wooProductVariable) {
        throw new Error(`Woo Product Variable - ${id} не найден.`);
      }

      return wooProductVariable.delete();
    });
};

export const addUpdateDbRecord = (dbRecord, dbRecordDetails, dbSchema) => {
  if (!dbRecord) {
    dbRecord = new dbSchema(dbRecordDetails);
  } else {
    for (const [key, value] of Object.entries(dbRecordDetails)) {
      dbRecord[key] = value;
    }
  }

  return dbRecord.save();
};

export const addUpdateMarketProduct = async (marketProductData) => {
  const Marketplace = getMarketplaceClasses()[marketProductData.marketType];
  if (!Marketplace) {
    throw new Error("Wrong market type.");
  }

  const marketProduct = new Marketplace(marketProductData._id);
  return marketProduct.addUpdateProduct(marketProductData);
};

export const addUpdateProduct = (productData) => {
  let productDetails = {};
  if (productData.name) {
    productDetails.name = productData.name;
  }
  productDetails.isActual = productData.isActual === "true";

  return Product.findById(productData._id)
    .exec()
    .then((product) => {
      if (!product) {
        product = new Product(productDetails);
      }

      for (const [key, value] of Object.entries(productDetails)) {
        product[key] = value;
      }

      return product.save();
    });
};

export const addProductVariation = (variationData) => {
  return Product.findById(variationData.product_id)
    .exec()
    .then((product) => {
      let variationDetails = {
        volume: variationData.variation_volume,
        product,
      };

      product = new ProductVariation(variationDetails);
      return product.save();
    });
};

export const deleteProduct = async (id) => {
  const product = await Product.findById(id).exec();
  if (!product) {
    throw new Error(`Продукт - ${id} не найден.`);
  }

  const variations = await ProductVariation.find({ product }).exec();
  if (variations.length > 0) {
    throw new Error("С продкутом связаны варианции");
  }

  return product.delete();
};

export const deleteProductVariation = async (id) => {
  const variation = await ProductVariation.findById(id).exec();
  if (!variation) {
    throw new Error(`Вариация - ${id} не найдена.`);
  }

  let isVariationHasConnectedProducts = false;
  for (const Marketplace of Object.values(getMarketplaceClasses())) {
    const marketProduct = await Marketplace._getDbProduct({ variation });
    if (marketProduct) {
      isVariationHasConnectedProducts = true;
    }
  }

  if (isVariationHasConnectedProducts) {
    throw new Error("С вариацией связаны товары");
  }

  return variation.delete();
};

export const deleteMarketProduct = async (marketType, id) => {
  let marketProduct;
  switch (marketType) {
    case "wb":
      marketProduct = await WbProduct.findById(id).exec();
      break;
    case "ozon":
      marketProduct = await OzonProduct.findById(id).exec();
      break;
    case "yandex":
      marketProduct = await YandexProduct.findById(id).exec();
      break;
    case "woo":
      marketProduct = await WooProduct.findById(id).exec();
      break;
  }

  if (!marketProduct) {
    throw new Error(`Продукт - ${id} не найден.`);
  }

  const connectedSell = await Sells.findOne({
    marketProduct: marketProduct._id.toString(),
  });

  if (connectedSell) {
    throw new Error(`Продукт - ${id} связан с записью о продаже.`);
  }

  return marketProduct.delete();
};

// export const updateYandexStocks = async (productsApiList) => {
//   try {
//     if (!productsApiList) {
//       productsApiList = await yandexService.getApiProductsList();
//     }
//
//     const productsFormatRequests = productsApiList.map((product) => {
//       const stock =
//         product.warehouses?.[0].stocks.find(
//           (stockType) => stockType.type === "FIT"
//         )?.count ?? 0;
//
//       return function (callback) {
//         YandexProduct.findOneAndUpdate(
//           { sku: product.shopSku },
//           { stockFBS: stock },
//           callback
//         );
//       };
//     });
//
//     async.parallel(productsFormatRequests);
//   } catch (e) {
//     console.error({ message: "Yandex stocks in db update failed.", e });
//   }
// };

export const updateOzonStocks = async (productsApiList) => {
  try {
    if (!productsApiList) {
      productsApiList = await Ozon._getApiProducts();
    }

    const { productsInfo, productsStocks } = productsApiList;

    const productsFormatRequests = Object.values(productsInfo).map(
      (product) => {
        return function (callback) {
          const productStocks = productsStocks.find(
            (stockInfo) => stockInfo.product_id === product.id
          );

          const stockFBO =
            productStocks.stocks.find((stock) => stock.type === "fbo")
              ?.present ?? 0;
          const stockFBS =
            productStocks.stocks.find((stock) => stock.type === "fbs")
              ?.present ?? 0;

          const updatedProduct = OzonProduct.findOneAndUpdate(
            { sku: product.id },
            { stock: stockFBO, stockFBS },
            (err) => {
              if (err) {
                callback(err, null);
                return;
              }
              callback(null, updatedProduct);
            }
          );
        };
      }
    );

    async.parallel(productsFormatRequests);
  } catch (e) {
    console.error({ message: "Ozon stocks in db update failed.", e });
  }
};

export const updateWbStocks = (fbmStocks) => {
  try {
    const productsFormatRequests = fbmStocks.map((fbmStock) => {
      return function (callback) {
        const wbProduct = new Wildberries({ sku: fbmStock.nmId });
        wbProduct._getDbProduct().then((wbDbProduct) => {
          if (wbDbProduct.stock === fbmStock.quantity) {
            callback(null, null);
            return;
          }

          wbDbProduct.stock = fbmStock.quantity;
          wbDbProduct.save((err) => {
            if (err) {
              console.error(
                `Error on WB product ${wbDbProduct.sku} update stock on ${fbmStock.quantity}
                ${err}`
              );

              callback(err, null);
              return;
            }

            callback(null, wbDbProduct);
          });
        });
      };
    });

    return async.parallel(productsFormatRequests);
  } catch (e) {
    console.error({ message: "Wb stocks in db update failed.", e });
  }
};

const redistributeFailedVariations = async () => {
  const variationsWithFailedStockUpdate = await getProductVariations(
    {
      stockUpdateStatus: [
        "update-failed-reverted",
        "update-failed-revert-failed",
      ],
    },
    "product"
  );

  if (variationsWithFailedStockUpdate.length === 0) {
    // no variations to be redistributed
    return [];
  }

  logger.log({
    level: "info",
    date: new Date(),
    message:
      "Start redistribute variations for variations with failed stock update",
  });

  return redistributeVariationsStock(variationsWithFailedStockUpdate, true);
};

// redistributeFailedVariations()
//   .then((result) => {
//     if (result.some((variation) => variation.error)) {
//       throw new Error("Redistribute failed");
//     }
//
//     logger.log({
//       level: "info",
//       date: new Date(),
//       message: "Success initial redistribute failed variations stock.",
//       result,
//     });
//   })
//   .catch((error) => {
//     console.error(error);
//     logger.log({
//       level: "error",
//       date: new Date(),
//       message: "Error while initial redistribute failed variations stock.",
//       error,
//     });
//   });
