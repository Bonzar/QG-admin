const wbService = require("../services/wbService");
// const { clearName } = require("../services/nameFormatter");

exports.getProductsList = async (req, res) => {
  try {
    const productsStocks = await wbService.getProductFbsStocks();
    const productIds = await wbService.getProductIdsList();

    const products = productIds.data["cards"].map((product) => {
      const stockInfo = productsStocks["stocks"].find(
        (productStock) => productStock["nmId"] === product["nmID"]
      );

      return {
        id: stockInfo?.barcode ?? "",
        articleWb: product["nmID"],
        article: product["vendorCode"],
        stockFBS: stockInfo?.stock ?? 0,
      };
    });

    res.render("wb-stocks", {
      title: "WB Stocks",
      headers: {
        ID: "id",
        Name: "article",
        // Article: "articleWb",
        FBS: "stockFBS",
      },
      products,
    });
  } catch (error) {
    console.log('1')
    console.log(error);
    
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.updateStock = (req, res) => {
  wbService
    .updateStock(req.query.barcode, req.query.stock)
    .then((result) => {
      if (result["error"]) {
        return res
          .status(400)
          .json({ message: result["errorText"], result: result });
      }
      res.json(result);
    })
    .catch((error) => {
      console.log(error);
      res.status(400).json({
        message: "Error while updating a product stock. Try again later.",
        error: error,
      });
    });
};
