const WooCommerceAPI = require("woocommerce-api");

const getWooCommerce = function () {
  if (!this.woocommerce) {
    this.woocommerce = new WooCommerceAPI({
      url: "https://queridosglitters.ru/",
      consumerKey: process.env.WOO_CLIENTID,
      consumerSecret: process.env.WOO_APIKEY,
      wpAPI: true,
      version: "wc/v3",
    });
  }

  return this.woocommerce;
};

exports.product_list = async (req, res) => {
  try {
    const WooCommerce = getWooCommerce();

    let wooProducts = [];
    let currentPage = 0;
    let totalPages = 1;
    do {
      currentPage++;
      const productOnPage = await WooCommerce.getAsync(
        `products?per_page=100&page=${currentPage}&order=asc`
      )
        .then((response) => {
          if (currentPage === 1) {
            totalPages = +response.headers["x-wp-totalpages"];
          }
          return JSON.parse(response.body);
        })
        .catch((error) => {
          console.log(error);
        });
      wooProducts.push(...productOnPage);
    } while (currentPage <= totalPages);

    res.render("site-stocks", {
      title: "Site Stocks",
      headers: {
        SKU: "productSku",
        Name: "productName",
        FBS: "productStockFBS",
      },
      products: wooProducts.map((product) => {
        return {
          productSku: product["id"],
          productName: product["name"],
          productStockFBS:
            product.stock_quantity ?? product.stock_status === "instock"
              ? "Есть"
              : "Нет",
        };
      }),
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
    const WooCommerce = getWooCommerce();

    const product = await WooCommerce.getAsync(`products/${req.params.id}`)
      .then((response) => {
        return JSON.parse(response.body);
      })
      .catch((error) => {
        console.log(error);
      });

    switch (product.type) {
      case "simple":
        res.json({ product_type: "simple", products: [product] });
        break;
      case "variable":
        WooCommerce.getAsync(`products/${req.params.id}/variations`)
          .then((response) => {
            res.json({
              product_type: "variation",
              products: JSON.parse(response.body),
            });
          })
          .catch((error) => {
            console.log(error);
          });
        break;
    }
  } catch (e) {
    res
      .status(400)
      .send("Error while getting stock info of product. Try again later.");
  }
};

exports.updateStock = (req, res) => {
  try {
    const WooCommerce = getWooCommerce();

    Object.keys(req.body).forEach((id) => {
      const productType = req.body[id].find((prop) =>
        Object.keys(prop).includes("product_type")
      )["product_type"];

      const variableId = req.body[id].find((prop) =>
        Object.keys(prop).includes("variable_id")
      )["variable_id"];

      const updateData = req.body[id].reduce((totalProps, current) => {
        if (current.product_type || current.variable_id) {
          return totalProps;
        }
        if (current.manage_stock) {
          current["manage_stock"] = current["manage_stock"] === "on";
        }
        if (current.stock_status) {
          current["manage_stock"] = false;
        }
        return { ...totalProps, ...current };
      }, {});

      switch (productType) {
        case "simple":
          WooCommerce.putAsync(`products/${id}`, updateData)
            .then((response) => {
              console.log(response.data);
            })
            .catch((error) => {
              console.log(error);
            });
          break;
        case "variation":
          WooCommerce.putAsync(
            `products/${variableId}/variations/${id}`,
            updateData
          )
            .then(() => {
              res.send();
            })
            .catch((error) => {
              console.log(error);
            });
          break;
        default:
          throw new Error("Product_type not valid");
      }
    });
  } catch (e) {
    res
      .status(400)
      .send("Error while updating stock of product. Try again later.");
  }
};
