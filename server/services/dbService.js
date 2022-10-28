const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const WbProduct = require("../models/WbProduct");
const YandexProduct = require("../models/YandexProduct");
const OzonProduct = require("../models/OzonProduct");
const WooProduct = require("../models/WooProduct");
const Sells = require("../models/Sells");
const WooProductVariable = require("../models/WooProductVariable");
const async = require("async");

const yandexService = require("./yandexService");
const wbService = require("./wbService");
const ozonService = require("./ozonService");
const wooService = require("./wooService");

const populateAll = (query, populates) => {
  for (const populate of populates) {
    query.populate(populate);
  }

  return query;
};

exports.getProductVariationById = async (id, populates = [], callback) => {
  try {
    const result = await populateAll(
      ProductVariation.findById(id),
      populates
    ).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getAllVariations = async (filter = {}, populates = [], callback) => {
  try {
    const result = await populateAll(
      ProductVariation.find(filter),
      populates
    ).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getProductById = async (id, callback) => {
  try {
    const result = await Product.findById(id).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getAllProducts = async (callback) => {
  try {
    const result = await Product.find().exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getWbProducts = async (filter = {}, callback) => {
  try {
    const result = await WbProduct.find(filter).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getWooProducts = async (filter = {}, populate = "", callback) => {
  try {
    const result = await WooProduct.find(filter).populate(populate).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getWooVariableProducts = async (filter = {}, callback) => {
  try {
    const result = await WooProductVariable.find(filter).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getYandexProducts = async (filter = {}, callback) => {
  try {
    const result = await YandexProduct.find(filter).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getOzonProducts = async (filter = {}, callback) => {
  try {
    const result = await OzonProduct.find(filter).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.getAllSells = async (filter = {}, populate = "", callback) => {
  try {
    const result = await Sells.find(filter).populate(populate).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

exports.addUpdateSell = async (
  _id = null,
  marketProductRef,
  productIdentifier,
  orderId,
  quantity,
  date,
  cbFunc
) => {
  try {
    let marketProduct;
    switch (marketProductRef) {
      case "WbProduct":
        marketProduct = await WbProduct.findOne({
          sku: productIdentifier,
        });
        break;
      case "OzonProduct":
        marketProduct = await OzonProduct.findOne({
          sku: +productIdentifier,
        });
        break;
      case "YandexProduct":
        marketProduct = await YandexProduct.findOne({
          sku: productIdentifier,
        });
        break;
      case "WooProduct":
        marketProduct = await WooProduct.findOne({
          id: +productIdentifier,
        });
        break;
    }

    let sellDetails = {
      marketProductRef,
      orderId,
      quantity: +quantity,
      date: new Date(date),
      marketProduct,
    };

    let sell;
    if (_id) {
      sell = await Sells.findById(_id).exec();
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

      console.log("Sell saved.");
      cbFunc(null, sell);
    });
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.addUpdateWooProductVariable = async (_id = null, id, cbFunc) => {
  try {
    let wooProductVariable;
    let wooProductVariableDetails = {
      id: +id,
    };

    if (_id) {
      wooProductVariable = await WooProductVariable.findById(_id).exec();
      for (const [key, value] of Object.entries(wooProductVariableDetails)) {
        wooProductVariable[key] = value;
      }
    } else {
      wooProductVariable = new WooProductVariable(wooProductVariableDetails);
    }

    wooProductVariable.save((err) => {
      if (err) {
        console.log(err);
        cbFunc(err, null);
        return;
      }

      cbFunc(null, wooProductVariable);
    });
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.deleteWooProductVariable = async (id, cbFunc) => {
  try {
    const wooProductVariable = await WooProductVariable.findById(id).exec();

    if (!wooProductVariable) {
      cbFunc(new Error(`Woo Product Variable - ${id} не найден.`), null);
      return;
    }

    wooProductVariable.delete(cbFunc);
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.addUpdateMarketProduct = async (marketProductData, cbFunc) => {
  const variationMarketProp = `${marketProductData.marketType}Product`;

  // Получение продукта в зависимости от типа маркетплейса
  let marketProduct = null;
  let allApiProducts = null;
  let wooResults;
  let isProductExistsOnMarketplace = false;

  if (!["wb", "yandex", "ozon", "woo"].includes(marketProductData.marketType))
    return cbFunc(new Error("Не верный тип маркетплейса."));

  switch (marketProductData.marketType) {
    case "wb":
      marketProduct = await WbProduct.findById(marketProductData._id).exec();
      allApiProducts = (await wbService.getApiProductsInfoList()).data["cards"];
      break;
    case "yandex":
      marketProduct = await YandexProduct.findById(
        marketProductData._id
      ).exec();
      allApiProducts = await yandexService.getApiSkusList();
      break;
    case "ozon":
      marketProduct = await OzonProduct.findById(marketProductData._id).exec();
      allApiProducts = (await ozonService.getProductsStockList()).result.items;
      break;
    case "woo":
      wooResults = await async.parallel({
        marketProduct(callback) {
          WooProduct.findById(marketProductData._id).exec(callback);
        },
        apiProduct(callback) {
          switch (marketProductData.type) {
            case "simple":
              wooService.getProductInfo(marketProductData.id, callback);
              break;
            case "variation":
              wooService.getProductVariationInfo(
                marketProductData.parentVariable,
                marketProductData.id,
                callback
              );
              break;
          }
        },
        parentVariable(callback) {
          WooProductVariable.findOne({
            id: marketProductData.parentVariable,
          }).exec(callback);
        },
      });

      marketProduct = wooResults.marketProduct;

      isProductExistsOnMarketplace = wooResults.apiProduct.data?.status !== 404;
      marketProductData.parentVariable = wooResults.parentVariable;
      break;
  }

  // Обновления
  await async.parallel(
    {
      // Обновление продукта маркетплейса
      marketProductUpdate(cbPart) {
        async.waterfall(
          [
            (callback) => {
              const marketProductDetails = {};
              // Common fields
              if (marketProductData.sku) {
                marketProductDetails.sku = marketProductData.sku;
              }
              if (marketProductData.article) {
                marketProductDetails.article = marketProductData.article;
              }
              switch (marketProductData.isActual) {
                case "true":
                  marketProductDetails.isActual = true;
                  break;
                case "false":
                  marketProductDetails.isActual = false;
                  break;
                default:
                  marketProductDetails.isActual = true;
              }
              // Wb fields
              if (marketProductData.barcode) {
                marketProductDetails.barcode = marketProductData.barcode;
              }
              // Woo fields
              if (marketProductData.type) {
                marketProductDetails.type = marketProductData.type;
              }
              if (marketProductData.id) {
                marketProductDetails.id = marketProductData.id;
              }
              if (marketProductData.parentVariable) {
                marketProductDetails.parentVariable =
                  marketProductData.parentVariable;
              } else if (marketProductData.marketType === "woo") {
                marketProductDetails.parentVariable = undefined;
              }

              switch (marketProductData.marketType) {
                case "wb":
                  isProductExistsOnMarketplace = [
                    allApiProducts.find(
                      (product) => +product["nmID"] === +marketProductData.sku
                    ),
                    allApiProducts.find(
                      (product) =>
                        product["vendorCode"] === marketProductData.article
                    ),
                  ].every((check) => check);
                  break;
                case "yandex":
                  isProductExistsOnMarketplace = allApiProducts.includes(
                    marketProductData.sku
                  );
                  break;
                case "ozon":
                  isProductExistsOnMarketplace = [
                    allApiProducts.find(
                      (product) =>
                        +product.product_id === +marketProductData.sku
                    ),
                    allApiProducts.find(
                      (product) =>
                        product.offer_id === marketProductData.article
                    ),
                  ].every((check) => check);
                  break;
              }

              if (!isProductExistsOnMarketplace) {
                callback(
                  new Error(
                    "Идентификатор товара не существует в базе маркетплейса"
                  ),
                  null
                );
                return;
              }

              if (!marketProduct) {
                switch (marketProductData.marketType) {
                  case "wb":
                    marketProduct = new WbProduct(marketProductDetails);
                    break;
                  case "yandex":
                    marketProduct = new YandexProduct(marketProductDetails);
                    break;
                  case "ozon":
                    marketProduct = new OzonProduct(marketProductDetails);
                    break;
                  case "woo":
                    marketProduct = new WooProduct(marketProductDetails);
                    break;
                }
              } else {
                for (const [key, value] of Object.entries(
                  marketProductDetails
                )) {
                  marketProduct[key] = value;
                }
              }

              marketProduct.save((err) => {
                if (err) {
                  console.log(err);
                  callback(err, null);
                  return;
                }

                callback(null, marketProduct);
              });
            },
          ],
          cbPart
        );
      },
      // Обновление остатков продкута
      fbsStockUpdate(cbPart) {
        if (!marketProductData.stockFBS) {
          cbPart(null, null);
          return;
        }

        switch (marketProductData.marketType) {
          case "wb":
            wbService.updateApiStock(
              marketProductData.barcode,
              marketProductData.stockFBS,
              cbPart
            );
            break;
          case "yandex":
            yandexService.updateApiStock(
              marketProductData.sku,
              marketProductData.stockFBS,
              cbPart
            );
            break;
          case "ozon":
            ozonService.updateApiStock(
              marketProductData.article,
              marketProductData.stockFBS,
              cbPart
            );
            break;
          case "woo":
            wooService.updateProduct(
              marketProductData.type,
              marketProductData.parentVariable?.id,
              marketProductData.id,
              { stock_quantity: +marketProductData.stockFBS },
              cbPart
            );
            break;
        }
      },
      // Обновление вариации
      variationUpdate(cbPart) {
        async.waterfall(
          [
            // Обновление вариации 1. Поиск новой и старой вариации
            (callback) => {
              async.parallel(
                {
                  oldVariation(callback) {
                    ProductVariation.findOne(
                      {
                        [variationMarketProp]: marketProduct,
                      },
                      callback
                    );
                  },
                  newVariation(callback) {
                    Product.findById(marketProductData.product_id).exec(
                      (err, product) => {
                        ProductVariation.findOne(
                          {
                            product,
                            volume: marketProductData.variation_volume,
                          },
                          callback
                        );
                      }
                    );
                  },
                  marketProduct(callback) {
                    callback(null, marketProduct);
                  },
                },
                callback
              );
            },
            // Обновление вариации 2. Удаление старой привязки при необходимости
            (results, callback) => {
              const { newVariation, oldVariation, marketProduct } = results;

              // Вариация не требует обновления
              if (
                oldVariation?.[variationMarketProp]?.filter(
                  (product) =>
                    product.toString() === marketProduct._id.toString()
                ).length > 0 &&
                newVariation?.[variationMarketProp]?.filter(
                  (product) =>
                    product.toString() === marketProduct._id.toString()
                ).length > 0
              ) {
                cbPart(null, marketProduct);
                return;
              }

              if (!newVariation && marketProductData.product_id) {
                callback(
                  new Error(
                    `Вариация "${marketProductData.variation_volume}", для продукта: ${marketProductData.product_id} не найдена.`
                  ),
                  marketProduct
                );
                return;
              }

              // Если старая вариация найдена -> удаляем связь
              if (oldVariation) {
                oldVariation[variationMarketProp].splice(
                  oldVariation[variationMarketProp].indexOf(marketProduct)
                );

                if (oldVariation[variationMarketProp].length === 0) {
                  oldVariation[variationMarketProp] = undefined;
                }

                oldVariation.save((err) => {
                  if (err) {
                    callback(err, null);
                    return;
                  }

                  callback(null, { newVariation, marketProduct });
                });
                return;
              }

              callback(null, { newVariation, marketProduct });
            },
            // Обновление вариации 3. Создание новой связи при необходимости
            (results, callback) => {
              const { newVariation, marketProduct } = results;

              // Если новая вариация указана -> создаем связь
              if (newVariation) {
                if (!newVariation[variationMarketProp]) {
                  newVariation[variationMarketProp] = [];
                }
                newVariation[variationMarketProp].push(marketProduct);
                newVariation.save((err) => {
                  if (err) {
                    callback(err, null);
                    return;
                  }

                  callback(null, marketProduct);
                });
                return;
              }
              callback(null, marketProduct);
            },
          ],
          cbPart
        );
      },
    },
    cbFunc
  );
};

exports.addUpdateProduct = async (productData, cbFunc) => {
  try {
    let product;
    product = await Product.findById(productData._id).exec();

    let productDetails = {};
    if (productData.name) {
      productDetails.name = productData.name;
    }
    switch (productData.isActual) {
      case "true":
        productDetails.isActual = true;
        break;
      case "false":
        productDetails.isActual = false;
        break;
      default:
        productDetails.isActual = true;
    }

    if (!product) {
      product = new Product(productDetails);
    } else {
      for (const [key, value] of Object.entries(productDetails)) {
        product[key] = value;
      }
    }

    product.save(cbFunc);
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.addProductVariation = async (variationData, cbFunc) => {
  try {
    let product;
    product = await Product.findById(variationData.product_id).exec();

    let variationDetails = {
      volume: variationData.variation_volume,
      product,
    };

    product = new ProductVariation(variationDetails);
    product.save(cbFunc);
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.deleteProduct = async (id, cbFunc) => {
  try {
    const product = await Product.findById(id).exec();

    if (!product) {
      cbFunc(new Error(`Продукт - ${id} не найден.`), null);
      return;
    }

    const variations = await ProductVariation.find({ product }).exec();

    if (variations.length > 0) {
      cbFunc(new Error("С продкутом связаны варианции"), null);
      return;
    }

    product.delete(cbFunc);
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.deleteProductVariation = async (id, cbFunc) => {
  try {
    const variation = await ProductVariation.findById(id).exec();

    if (!variation) {
      cbFunc(new Error(`Вариация - ${id} не найдена.`), null);
      return;
    }

    if (
      [
        variation.yandexProduct,
        variation.ozonProduct,
        variation.wbProduct,
        variation.wooProduct,
      ].some((products) => products?.length > 0)
    ) {
      cbFunc(new Error("С вариацией связаны товары"), null);
      return;
    }

    variation.delete(cbFunc);
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.deleteMarketProduct = async (marketType, id, cbFunc) => {
  try {
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

    const variation = await ProductVariation.findOne({
      [`${marketType}Product`]: marketProduct,
    }).exec();
    if (variation) {
      cbFunc(new Error("Товар связан с вариацией"), null);
      return;
    }

    marketProduct.delete(cbFunc);
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};

exports.updateYandexStocks = async (productsApiList) => {
  try {
    if (!productsApiList) {
      productsApiList = await yandexService.getApiProductsList();
    }

    const productsFormatRequests = productsApiList.map((product) => {
      const stock =
        product.warehouses?.[0].stocks.find(
          (stockType) => stockType.type === "FIT"
        )?.count ?? 0;

      return function (callback) {
        YandexProduct.findOneAndUpdate(
          { sku: product.shopSku },
          { stockFBS: stock },
          callback
        );
      };
    });

    async.parallel(productsFormatRequests);
  } catch (e) {
    console.log({ message: "Yandex stocks in db update failed.", e });
  }
};

exports.updateOzonStocks = async (productsApiList) => {
  try {
    if (!productsApiList) {
      productsApiList = await ozonService.getApiProductsList();
    }

    const { productsInfo, productsStockList } = productsApiList;

    const productsFormatRequests = productsInfo.map((product) => {
      return function (callback) {
        const productStocks = productsStockList.find(
          (stockInfo) => stockInfo.product_id === product.id
        );

        const stockFBO = productStocks.stocks[0]?.present ?? 0;
        const stockFBS = productStocks.stocks[1]?.present ?? 0;

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
    });

    async.parallel(productsFormatRequests);
  } catch (e) {
    console.log({ message: "Ozon stocks in db update failed.", e });
  }
};

exports.updateWbStocks = async (productsApiList, productFbwStocks) => {
  try {
    if (!productsApiList) {
      productsApiList = await wbService.getApiProductsInfoList();
    }
    if (!productFbwStocks) {
      productFbwStocks = await wbService.getApiProductFbwStocks();
    }

    if (!productFbwStocks)
      return console.log({ message: "Wb stocks in db update failed." });

    const productsFormatRequests = productsApiList.data["cards"].map(
      (product) => {
        return function (callback) {
          const stockFBW =
            productFbwStocks
              .filter((fbwStock) => fbwStock["nmId"] === product["nmID"])
              .reduce((total, current) => total + current.quantity, 0) ?? 0;

          const updatedProduct = WbProduct.findOneAndUpdate(
            { sku: product["nmID"] },
            { stock: stockFBW },
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
    console.log({ message: "Wb stocks in db update failed.", e });
  }
};

exports.getVariationProductsStocks = (id, cbFunc) => {
  async.waterfall(
    [
      (callback) => {
        exports.getProductVariationById(
          id,
          [
            {
              path: "wooProduct",
              populate: { path: "parentVariable" },
            },
            "product yandexProduct wbProduct ozonProduct",
          ],
          callback
        );
      },
      (productVariation, callback) => {
        async.parallel(
          {
            fbsYandexStocks(callback) {
              if (
                !productVariation.yandexProduct ||
                productVariation.yandexProduct.length === 0
              )
                return callback(null, null);

              const fbsYandexStocksRequests =
                productVariation.yandexProduct.map((yandexProduct) => {
                  return (callback) => {
                    yandexService.getApiProductsList(
                      [yandexProduct.sku],
                      (err, result) => {
                        if (err) {
                          console.log(err);
                          callback(err, null);
                          return;
                        }

                        callback(null, {
                          identifier: yandexProduct.sku,
                          stock: result[0].warehouses?.[0].stocks.find(
                            (stockType) => stockType.type === "FIT"
                          )?.count,
                        });
                      }
                    );
                  };
                });

              async.parallel(fbsYandexStocksRequests, (err, result) => {
                if (err) {
                  console.log(err);
                  return callback(null, { error: err });
                }
                callback(null, result);
              });
            },
            fbsWooStocks(callback) {
              if (
                !productVariation.wooProduct ||
                productVariation.wooProduct.length === 0
              )
                return callback(null, null);

              const fbsWooStocksRequests = productVariation.wooProduct.map(
                (wooProduct) => {
                  return (callback) => {
                    const cb = (err, result) => {
                      if (err) {
                        console.log(err);
                        callback(err, null);
                        return;
                      }

                      callback(null, {
                        identifier: wooProduct.id,
                        stock: result.stock_quantity,
                      });
                    };

                    switch (wooProduct.type) {
                      case "simple":
                        wooService.getProductInfo(wooProduct.id, cb);
                        break;
                      case "variation":
                        wooService.getProductVariationInfo(
                          wooProduct.parentVariable.id,
                          wooProduct.id,
                          cb
                        );
                        break;
                    }
                  };
                }
              );

              async.parallel(fbsWooStocksRequests, (err, result) => {
                if (err) {
                  console.log(err);
                  return callback(null, { error: err });
                }
                callback(null, result);
              });
            },
            fbsWbStocks(callback) {
              if (
                !productVariation.wbProduct ||
                productVariation.wbProduct.length === 0
              )
                return callback(null, null);

              const fbsWbStocksRequests = productVariation.wbProduct.map(
                (wbProduct) => {
                  return (callback) => {
                    wbService.getApiProductFbsStocks(
                      wbProduct.barcode,
                      (err, result) => {
                        if (err) {
                          console.log(err);
                          callback(err, null);
                          return;
                        }

                        callback(null, {
                          identifier: wbProduct.sku,
                          stock: result.stocks?.[0].stock ?? 0,
                        });
                      }
                    );
                  };
                }
              );

              async.parallel(fbsWbStocksRequests, (err, result) => {
                if (err) {
                  console.log(err);
                  return callback(null, { error: err });
                }
                callback(null, result);
              });
            },
            fbsOzonStocks(callback) {
              if (
                !productVariation.ozonProduct ||
                productVariation.ozonProduct.length === 0
              )
                return callback(null, null);

              const fbsOzonStocksRequests = productVariation.ozonProduct.map(
                (ozonProduct) => {
                  return (callback) => {
                    ozonService.getProductsStockList(
                      {
                        product_id: [ozonProduct.sku],
                        visibility: "ALL",
                      },
                      (err, result) => {
                        if (err) {
                          console.log(err);
                          callback(err, null);
                          return;
                        }

                        callback(null, {
                          identifier: ozonProduct.sku,
                          stock: result.result.items[0].stocks[1]?.present,
                        });
                      }
                    );
                  };
                }
              );

              async.parallel(fbsOzonStocksRequests, (err, result) => {
                if (err) {
                  console.log(err);
                  return callback(null, { error: err });
                }
                callback(null, result);
              });
            },
          },
          (err, results) => {
            if (err) {
              console.log(err);
              callback(err, null);
              return;
            }

            callback(null, [productVariation, results]);
          }
        );
      },
    ],
    cbFunc
  );
};
