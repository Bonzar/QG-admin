const dbService = require("../services/dbService");
const async = require("async");
const { validationResult } = require("express-validator");
const wbService = require("../services/wbService");
const yandexService = require("../services/yandexService");
const ozonService = require("../services/ozonService");

exports.getProductVariationPage = async (req, res) => {
  try {
    async.parallel(
      {
        productVariation(callback) {
          dbService.getProductVariationById(
            req.params.id,
            "product yandexProduct wbProduct ozonProduct",
            callback
          );
        },
        allProducts(callback) {
          dbService.getAllProducts(callback);
        },
        allWbProducts(callback) {
          dbService.getWbProducts({}, callback);
        },
        allYandexProducts(callback) {
          dbService.getYandexProducts({}, callback);
        },
        allOzonProducts(callback) {
          dbService.getOzonProducts({}, callback);
        },
      },
      async (err, results) => {
        if (err) {
          console.log(err);
          res.status(400).json({
            message: "Error while getting product page. Try again later.",
            err,
          });
          return;
        }

        const {
          productVariation,
          allProducts,
          allWbProducts,
          allYandexProducts,
          allOzonProducts,
        } = results;

        allOzonProducts.sort((product1, product2) =>
          product1.article.localeCompare(product2.article)
        );

        allWbProducts.sort((product1, product2) =>
          product1.article.localeCompare(product2.article)
        );

        allYandexProducts.sort(
          (product1, product2) =>
            product1.article?.localeCompare(product2.article) ??
            product1.sku.localeCompare(product2.sku)
        );

        let fbsYandexStocks = null;
        if (productVariation.yandexProduct) {
          fbsYandexStocks = (
            await yandexService.getApiProductsList([
              productVariation.yandexProduct.sku,
            ])
          )[0].warehouses?.[0].stocks.find(
            (stockType) => stockType.type === "FIT"
          )?.count;
        }

        let fbsWbStocks = null;
        if (productVariation.wbProduct) {
          fbsWbStocks =
            (
              await wbService.getApiProductFbsStocks(
                productVariation.wbProduct.barcode
              )
            ).stocks?.[0].stock ?? 0;
        }

        let fbsOzonStocks = null;
        if (productVariation.ozonProduct) {
          fbsOzonStocks = (
            await ozonService.getProductsStockList({
              product_id: [productVariation.ozonProduct.sku],
              visibility: "ALL",
            })
          ).result.items[0].stocks[1]?.present;
        }

        res.render("variablePage", {
          title: `${productVariation.product.name} - ${productVariation.volume}`,
          variation: productVariation,
          fbsWbStocks,
          fbsYandexStocks,
          fbsOzonStocks,
          allProducts,
          allWbProducts,
          allYandexProducts,
          allOzonProducts,
        });
      }
    );
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ message: "Error while getting product variation page", error });
  }
};

exports.getDbMarketProductPage = async (req, res) => {
  try {
    const allProducts = await dbService.getAllProducts();

    const marketType = req.params.marketType;
    const productId = req.params.product_id;

    if (["yandex", "wb", "ozon"].includes(marketType)) {
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
        }

        const variationFilter = {};
        variationFilter[`${marketType}Product`] = marketProduct;

        const variation = (
          await dbService.getAllVariations(variationFilter, `product`)
        )[0];

        if (marketProduct) {
          res.render("marketProduct", {
            title: `Товар ${
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
          });
        }
      } else {
        res.render("marketProduct", {
          title: `Добавить новый товар ${
            marketType[0].toUpperCase() + marketType.slice(1).toLowerCase()
          } (БД)`,
          marketType,
          allProducts,
        });
      }
    } else {
      res.status(400).json({
        message: "Выбран не вырный маркетплейс.",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "Error while getting market product add page. Try again later.",
      error,
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
        res.status(400).json({ message: err.message });
        return;
      }

      res.json({ marketType: req.body.marketType, results });
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      error,
    });
  }
};
