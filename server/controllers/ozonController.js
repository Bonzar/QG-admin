const ozonService = require("../services/ozonService");

exports.getProductsList = async (req, res) => {
  try {
    const { productsInfo, productsStockList } =
      await ozonService.getProductsList();

    let products = productsInfo.map((product) => {
      const name = product.name
        .replaceAll(
          /[".:]|(Queridos Glir?tters)|(ГлиттерГель)|(Глиттер гель)|(Глиттер)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(набора)|(для блёсток)|(3)|(6)|(мл\.?($|\s))|(Блестки для глаз)/gi,
          ""
        )
        .replace("набор", "Набор:")
        .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ")
        .replace("Хайлайтер", "Хай")
        .trim();

      const productStocks = productsStockList.find(
        (stockInfo) => stockInfo.product_id === product.id
      );

      return {
        article: product.offer_id,
        name,
        stockFBO: productStocks.stocks[0]?.present ?? 0,
        stockFBS: productStocks.stocks[1]?.present ?? 0,
      };
    });

    // Filter only outofstock products (by FBS)
    if (req.query.stock_status === "outofstock") {
      products = products.filter((product) => {
        return product.stockFBS <= 0;
      });
    }

    // Filter only outofstock products (by FBO and FBS)
    if (req.query.stock_status === "outofstockall") {
      products = products.filter((product) => {
        return product.stockFBS <= 0 && product.stockFBO <= 0;
      });
    }

    products.sort((product1, product2) =>
      product1.name.localeCompare(product2.name)
    );

    res.render("ozon-stocks", {
      title: "Ozon Stocks",
      headers: {
        Article: "article",
        Name: "name",
        FBM: "stockFBO",
        FBS: "stockFBS",
      },
      products,
    });
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.updateStock = async (req, res) => {
  try {
    ozonService
      .updateStock(req.query.id, req.query.stock)
      .then((result) => {
        res.json(result);
      })
      .catch((e) => {
        console.log(e);
        res.status(500).json(e);
      });
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};
