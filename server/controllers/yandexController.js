const yandexService = require("../services/yandexService");

exports.getProductsList = async (req, res) => {
  try {
    let products = await yandexService.getProductsList();

    // Filter outofstock products only
    if (req.query.stock_status === "outofstock") {
      products = products.filter((product) => {
        return !product.warehouses?.[0].stocks.find(
          (stockType) => stockType.type === "FIT"
        )?.count;
      });
    }

    // Prepare product list to print
    const productsToPrint = products.map((product) => {
      // Take product stock if outofstock filter isn't enabled
      let productStocks = 0;
      if (req.query.stock_status !== "outofstock") {
        productStocks =
          product.warehouses?.[0].stocks.find(
            (stockType) => stockType.type === "FIT"
          )?.count ?? 0;
      }

      const productName = product.name
        .replaceAll(
          /[".:]|(Queridos Glir?tters)|(ГлиттерГель)|(Глиттер гель)|(Глиттер)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(набора)|(для блёсток)|(3)|(6)|(мл\.?($|\s))|(Блестки для глаз)/gi,
          ""
        )
        .replace("набор", "Набор:")
        .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ")
        .replace("Хайлайтер", "Хай")
        .trim();

      return {
        productSku: product.shopSku,
        productName,
        productStock: productStocks,
      };
    });

    // Sorting
    productsToPrint.sort((product1, product2) =>
      product1.productName.localeCompare(product2.productName)
    );

    res.render("yandex-stocks", {
      token: process.env.YANDEX_OAUTHTOKEN,
      title: "Yandex Stocks",
      headers: {
        SKU: "productSku",
        Name: "productName",
        FBS: "productStock",
      },
      products: productsToPrint,
    });
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.updateStock = async (req, res) => {
  try {
    yandexService
      .updateStock(req.query.sku, req.query.stock)
      .then((response) => {
        res.send(JSON.stringify(response.data));
      })
      .catch((error) => {
        console.log(error);
        res.status(500).json(error);
      });
  } catch (e) {
    res
      .status(400)
      .send("Error while updating stock of product. Try again later.");
  }
};
