const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const WbProduct = require("../models/WbProduct");
const YandexProduct = require("../models/YandexProduct");
const async = require("async");

const yandexService = require("./yandexService");
const wbService = require("./wbService");

exports.getProductInfo = async (id, callback) => {
  try {
    const result = await ProductVariation.findById(id)
      .populate("product yandexProduct wbProduct")
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

exports.getAllVariations = async (filter = {}, populate = "", callback) => {
  try {
    const result = await ProductVariation.find(filter)
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

exports.addMarketProduct = async (marketProductData, callback) => {
  await async.waterfall(
    [
      (callback) => {
        const marketProductDetails = {};

        if (marketProductData.sku) {
          marketProductDetails.sku = marketProductData.sku;
        }
        if (marketProductData.article) {
          marketProductDetails.article = marketProductData.article;
        }
        if (marketProductData.barcode) {
          marketProductDetails.barcode = marketProductData.barcode;
        }
        if (marketProductData.stockFBS) {
          marketProductDetails.stockFBS = marketProductData.stockFBS;
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

        let newMarketProduct = null;
        switch (marketProductData.marketType) {
          case "wb":
            newMarketProduct = new WbProduct(marketProductDetails);
            break;
          case "yandex":
            newMarketProduct = new YandexProduct(marketProductDetails);
            break;
        }
        if (newMarketProduct) {
          newMarketProduct.save(callback);
        } else {
          callback(
            new Error("Неверный тип маркетплейса на добавление продукта"),
            null
          );
        }
      },
      (newMarketProduct, callback) => {
        Product.findById(marketProductData.product_id).exec((err, product) => {
          if (err) {
            callback(err, null);
            return;
          }

          callback(null, [newMarketProduct, product]);
        });
      },
      (result, callback) => {
        const [newMarketProduct, product] = result;

        ProductVariation.findOne(
          {
            product,
            volume: marketProductData.variation_volume,
          },
          (err, variation) => {
            if (err) {
              callback(err, null);
              return;
            }

            callback(null, [newMarketProduct, variation]);
          }
        );
      },
      (result, callback) => {
        const [newMarketProduct, variation] = result;

        const updateRef = `${marketProductData.marketType}Product`;

        if (variation[updateRef]) {
          callback(
            new Error(
              `К вариации уже привязан продукт ${variation[updateRef]}`
            ),
            null
          );
          return;
        }

        variation[updateRef] = newMarketProduct;

        variation.save((err) => {
          if (err) {
            callback(err, null);
            return;
          }

          callback(null, newMarketProduct);
        });
      },
    ],
    callback
  );
};

exports.updateMarketProduct = async (marketProductData, cb) => {
  await async.waterfall(
    [
      (callback) => {
        switch (marketProductData.marketType) {
          case "wb":
            WbProduct.findById(marketProductData._id).exec(callback);
            break;
          case "yandex":
            YandexProduct.findById(marketProductData._id).exec(callback);
            break;
        }
      },
      (marketProduct, callback) => {
        const marketProductUpdateDetails = {};

        if (marketProductData.sku) {
          marketProductUpdateDetails.sku = marketProductData.sku;
        }
        if (marketProductData.id) {
          marketProductUpdateDetails.id = marketProductData.id;
        }
        if (marketProductData.article) {
          marketProductUpdateDetails.article = marketProductData.article;
        }
        if (marketProductData.barcode) {
          marketProductUpdateDetails.barcode = marketProductData.barcode;
        }
        if (marketProductData.stockFBS) {
          marketProductUpdateDetails.stockFBS = marketProductData.stockFBS;
        }
        switch (marketProductData.isActual) {
          case "true":
            marketProductUpdateDetails.isActual = true;
            break;
          case "false":
            marketProductUpdateDetails.isActual = false;
            break;
          default:
            marketProductUpdateDetails.isActual = true;
        }
        if (marketProduct) {
          for (const [key, value] of Object.entries(
            marketProductUpdateDetails
          )) {
            marketProduct[key] = value;
          }
          marketProduct.save((err) => {
            if (err) {
              console.log(err);
              callback(err, null);
            }

            callback(null, marketProduct);
          });
        } else {
          callback(
            new Error("Неверный тип маркетплейса на добавление продукта"),
            null
          );
        }
      },
      (marketProduct, callback) => {
        // Если не указан product_id продкута -> далее
        if (!marketProductData.product_id)
          return callback(null, [marketProduct, null]);

        Product.findById(marketProductData.product_id).exec((err, product) => {
          if (err) {
            callback(err, null);
            return;
          }
          callback(null, [marketProduct, product]);
        });
      },
      (result, callback) => {
        const [marketProduct, product] = result;
        // Если не указан product_id продкута -> далее
        if (!marketProductData.product_id)
          return callback(null, [marketProduct, null]);

        console.log(product);

        ProductVariation.findOne(
          {
            product,
            volume: marketProductData.variation_volume,
          },
          (err, variation) => {
            if (err) {
              callback(err, null);
              return;
            }
            callback(null, [marketProduct, variation]);
          }
        );
      },
      (results, callback) => {
        const [marketProduct, variation] = results;

        const updateRef = `${marketProductData.marketType}Product`;

        // В случае когда нет product_id нужно найти вариацию которую отчищать
        if (!variation) {
          ProductVariation.findOne(
            { [updateRef]: marketProductData._id },
            (err, result) => {
              if (err) {
                callback(err, null);
                return;
              }

              callback(null, [marketProduct, result]);
            }
          );
          return;
        }

        callback(null, [marketProduct, variation]);
      },
      (results, callback) => {
        const [marketProduct, variation] = results;

        const updateRef = `${marketProductData.marketType}Product`;

        // Если до сих пор нет вариации, значит product_id не указан и существующей вариации со связью нет -> все уже готово
        if (!variation) return callback(null, marketProduct);

        // Если не указан id продкута -> удаляем связь продкта маркетплейса и вариации
        if (!marketProductData.product_id) {
          variation[updateRef] = undefined;
          // Иначе устанавливаем новую
        } else {
          if (variation[updateRef]) {
            callback(
              new Error(
                `К вариации уже привязан продукт ${variation[updateRef]}`
              ),
              null
            );
            return;
          }

          variation[updateRef] = marketProduct;
        }

        variation.save((err) => {
          if (err) {
            callback(err, null);
            return;
          }

          callback(null, marketProduct);
        });
      },
    ],
    cb
  );
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

    await async.parallel(productsFormatRequests);
  } catch (e) {
    console.log({ message: "Yandex stocks in db update failed.", e });
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

    await async.parallel(productsFormatRequests);
  } catch (e) {
    console.log({ message: "Wb stocks in db update failed.", e });
  }
};
