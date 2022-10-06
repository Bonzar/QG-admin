const wooService = require("../services/wooService");

exports.getProductsList = async (req, res) => {
  try {
    const tableFilters = `${
      req.query.stock_status ? `&stock_status=${req.query.stock_status}` : ""
    }${req.query.category ? `&category=${req.query.category}` : ""}${
      req.query.orderby &&
      [
        "date",
        "id",
        "include",
        "title",
        "slug",
        "price",
        "popularity",
        "rating",
      ].includes(req.query.orderby)
        ? `&orderby=${req.query.orderby}`
        : ""
    }`;

    const products = (await wooService.getProductList(tableFilters))
      .sort((product1, product2) => product1.name.localeCompare(product2.name))
      .map((product) => {
        return {
          productId: product["id"],
          productName: product["name"],
          productStockFBS:
            product.stock_quantity ?? product.stock_status === "instock"
              ? "Есть"
              : "Нет",
        };
      });

    res.render("woo-stocks", {
      title: "Site Stocks",
      headers: {
        ID: "productId",
        Name: "productName",
        FBS: "productStockFBS",
      },
      products,
    });
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.getStockUpdateInfo = async (req, res) => {
  try {
    res.json(await wooService.getStockUpdateInfo(req.params.id));
  } catch (e) {
    res
      .status(400)
      .send("Error while getting stock info of product. Try again later.");
  }
};

exports.updateStock = (req, res) => {
  try {
    wooService
      .updateStock(req.body)
      .then(() => {
        res.send();
      })
      .catch((e) => {
        console.log(e);
        res.status(500).json(e);
      });
  } catch (e) {
    res
      .status(400)
      .send("Error while updating stock of product. Try again later.");
  }
};
