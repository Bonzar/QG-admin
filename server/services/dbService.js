const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const WbProduct = require("../models/WbProduct");
const YandexProduct = require("../models/YandexProduct");
const OzonProduct = require("../models/OzonProduct");
const WooProduct = require("../models/WooProduct");
const WooProductVariable = require("../models/WooProductVariable");
const async = require("async");

const yandexService = require("./yandexService");
const wbService = require("./wbService");
const ozonService = require("./ozonService");

exports.getProductVariationById = async (id, populate = "", callback) => {
  try {
    const result = await ProductVariation.findById(id)
      .populate(populate)
      .exec();

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
    const populateAll = (query) => {
      for (const populate of populates) {
        query.populate(populate);
      }

      return query;
    };

    const result = await populateAll(ProductVariation.find(filter)).exec();

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

exports.getWooProducts = async (filter = {}, callback) => {
  try {
    const result = await WooProduct.find(filter).exec();

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

exports.addUpdateMarketProduct = async (marketProductData, cbFunc) => {
  const variationMarketProp = `${marketProductData.marketType}Product`;

  // Получение продукта в зависимости от типа маркетплейса
  let marketProduct = null;
  let allApiProducts = null;

  if (!["wb", "yandex", "ozon"].includes(marketProductData.marketType))
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

              if (marketProductData.sku) {
                marketProductDetails.sku = marketProductData.sku;
              }
              if (marketProductData.id) {
                marketProductDetails.id = marketProductData.id;
              }
              if (marketProductData.article) {
                marketProductDetails.article = marketProductData.article;
              }
              if (marketProductData.barcode) {
                marketProductDetails.barcode = marketProductData.barcode;
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

              let isProductExistsOnMarketplace = false;
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
          "product yandexProduct wbProduct ozonProduct",
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
                          sku: yandexProduct.sku,
                          stock: result[0].warehouses?.[0].stocks.find(
                            (stockType) => stockType.type === "FIT"
                          )?.count,
                        });
                      }
                    );
                  };
                });

              async.parallel(fbsYandexStocksRequests, callback);
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
                          sku: wbProduct.sku,
                          stock: result.stocks?.[0].stock ?? 0,
                        });
                      }
                    );
                  };
                }
              );

              async.parallel(fbsWbStocksRequests, callback);
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
                          sku: ozonProduct.sku,
                          stock: result.result.items[0].stocks[1]?.present,
                        });
                      }
                    );
                  };
                }
              );

              async.parallel(fbsOzonStocksRequests, callback);
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
