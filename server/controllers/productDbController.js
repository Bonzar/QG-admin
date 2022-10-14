const dbService = require("../services/dbService");
const async = require("async");
const { validationResult } = require("express-validator");

exports.getProductVariationPage = async (req, res) => {
  try {
    async.parallel(
      {
        productVariation(callback) {
          dbService.getProductInfo(req.params.id, callback);
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
      },
      (err, results) => {
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
        } = results;

        allWbProducts.sort((product1, product2) =>
          product1.article.localeCompare(product2.article)
        );
        allYandexProducts.sort(
          (product1, product2) =>
            product1.article?.localeCompare(product2.article) ??
            product1.sku.localeCompare(product2.sku)
        );

        res.render("variablePage", {
          title: `${productVariation.product.name} - ${productVariation.volume}`,
          variation: productVariation,
          allProducts,
          allWbProducts,
          allYandexProducts,
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

    console.log(marketType);

    if (["yandex", "wb"].includes(marketType)) {
      // if id exist -> update product ELSE add new
      if (productId) {
        let marketProduct = null;
        switch (marketType) {
          case "wb":
            marketProduct = (
              await dbService.getWbProducts({ _id: productId })
            )[0];
            break;
          case "yandex":
            marketProduct = (
              await dbService.getYandexProducts({ _id: productId })
            )[0];
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

exports.addDbMarketProduct = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.addMarketProduct(req.body, (err) => {
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

      res.send();
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      error,
    });
  }
};

exports.updateDbMarketProduct = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.updateMarketProduct(req.body, (err) => {
      if (err) {
        if (err.code === 11000) {
          err.message = "Поле должно быть уникальным";
        }
        res.status(400).json({ message: err.message });
        return;
      }

      res.send();
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      error,
    });
  }
};
