const WooCommerceAPI = require("woocommerce-api");
const async = require("async");

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

exports.product_list = (req, res, next) => {
  try {
    const WooCommerce = getWooCommerce();

    const tableFilter = `${
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

    async.waterfall(
      [
        function (callback) {
          WooCommerce.getAsync(
            `products?per_page=7&page=1&order=asc${tableFilter}`
          ).then((response) => {
            const totalPages = +response.headers["x-wp-totalpages"];
            const firstProducts = JSON.parse(response.body);

            callback(null, firstProducts, totalPages);
          });
        },
        (firstProducts, totalPages, callback) => {
          const pages = [
            ...Array.from({ length: totalPages + 1 }).keys(),
          ].slice(2);
          const requests = pages.map((page) => {
            return async () => {
              return await WooCommerce.getAsync(
                `products?per_page=8&page=${page}&order=asc${tableFilter}`
              )
                .then((response) => {
                  return JSON.parse(response.body);
                })
                .catch((e) => {
                  if (e.name === "SyntaxError") {
                    throw new Error(
                      "Слишком много запросов к API, подождите немного"
                    );
                  }
                });
            };
          });

          async.parallel(requests, (err, results) => {
            callback(err, [firstProducts, ...results]);
          });
        },
      ],
      (err, result) => {
        if (err || result[0]?.data?.status === 400) {
          return next(err || result[0].message);
        }

        const products = result.reduce((total, currentPack) => {
          total.push(...currentPack);
          return total;
        }, []);

        res.render("site-stocks", {
          title: "Site Stocks",
          headers: {
            SKU: "productSku",
            Name: "productName",
            FBS: "productStockFBS",
          },
          products: products.map((product) => {
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
      }
    );
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
