const ozonService = require("../services/ozonService");

exports.getProductsList = async (req, res) => {
  try {
    let products = (await ozonService.getProductsList()).result.items;

    // Filter only outofstock products (by FBS)
    if (req.query.stock_status === "outofstock") {
      products = products.filter((product) => {
        return !product.stocks[1]?.present;
      });
    }

    // Filter only outofstock products (by FBO and FBS)
    if (req.query.stock_status === "outofstockall") {
      products = products.filter((product) => {
        return !product.stocks[0]?.present && !product.stocks[1]?.present;
      });
    }

    res.render("ozon-stocks", {
      title: "Ozon Stocks",
      headers: {
        SKU: "productSku",
        Name: "productName",
        FBM: "productStockFBM",
        FBS: "productStockFBS",
      },
      products: products.map((product) => {
        return {
          productSku: product["product_id"],
          productName: product["offer_id"],
          productStockFBM: product.stocks[0]?.present ?? 0,
          productStockFBS:
            // no exact product stock if outofstock filter enabled
            req.query.stock_status === "outofstock"
              ? 0
              : product.stocks[1]?.present ?? 0,
        };
      }),
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
