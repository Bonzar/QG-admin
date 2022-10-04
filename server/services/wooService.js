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

exports.getProductList = async (tableFilters) => {
  const WooCommerce = getWooCommerce();

  const fetchedProducts = await async.waterfall([
    function (callback) {
      WooCommerce.getAsync(
        `products?per_page=7&page=1&order=asc${tableFilters}`
      ).then((response) => {
        const totalPages = +response.headers["x-wp-totalpages"];
        const firstProducts = JSON.parse(response.body);

        callback(null, firstProducts, totalPages);
      });
    },
    (firstProducts, totalPages, callback) => {
      const pages = [...Array.from({ length: totalPages + 1 }).keys()].slice(2);
      const requests = pages.map((page) => {
        return async () => {
          return await WooCommerce.getAsync(
            `products?per_page=8&page=${page}&order=asc${tableFilters}`
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
  ]);

  // Unpacking array of objects arrays in one array with naming replace
  return fetchedProducts.reduce((totalList, currentPack) => {
    currentPack.map((product) => {
      product.name = product.name
        .replace(/Глиттер-гель/i, "")
        .replace(/Глиттер-набор/i, "Набор")
        .replace(/Хайлайтер/i, "Хай")
        .trim();
      return product;
    });

    totalList.push(...currentPack);
    return totalList;
  }, []);
};

exports.getStockUpdateInfo = async (id) => {
  const WooCommerce = getWooCommerce();

  const product = await WooCommerce.getAsync(`products/${id}`).then(
    (response) => {
      return JSON.parse(response.body);
    }
  );

  switch (product.type) {
    case "simple":
      return { product_type: "simple", products: [product] };
    case "variable":
      return await WooCommerce.getAsync(`products/${id}/variations`).then(
        (response) => {
          return {
            product_type: "variation",
            products: JSON.parse(response.body),
          };
        }
      );
  }
};

exports.updateStock = async (products) => {
  const WooCommerce = getWooCommerce();

  // Iterate each product id given in request
  await Object.keys(products).forEach((id) => {
    const productType = products[id].find((prop) =>
      Object.keys(prop).includes("product_type")
    )["product_type"];

    const variableId = products[id].find((prop) =>
      Object.keys(prop).includes("variable_id")
    )["variable_id"];

    const updateData = products[id].reduce((totalProps, current) => {
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
        WooCommerce.putAsync(`products/${id}`, updateData);
        break;
      case "variation":
        WooCommerce.putAsync(
          `products/${variableId}/variations/${id}`,
          updateData
        );
        break;
      default:
        throw new Error("Product_type not valid");
    }
  });
};
