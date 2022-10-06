const WooCommerceAPI = require("woocommerce-api");
const nameFormatter = require("../services/nameFormatter");
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

  // Setup optimal count requests pages
  let totalPages = 30;

  // Array of page numbers for requests
  const pages = [...Array.from({ length: totalPages + 1 }).keys()].slice(1);

  // Array of request functions for optimal count requests pages
  const requests = pages.map((currentPage) => {
    return async function getProductsPack(page = currentPage) {
      // Request it self
      return await WooCommerce.getAsync(
        `products?per_page=7&page=${page}&order=asc${tableFilters}`
      )
        .then(async (response) => {
          let productsPack = JSON.parse(response.body);

          // if optimal count requests pages doesn't fit, missing pages will be caused by recursion
          const realTotalPages = +response.headers["x-wp-totalpages"];
          if (page === 1 && totalPages < realTotalPages) {
            const additionalPages = [
              ...Array.from({ length: realTotalPages + 1 }).keys(),
            ].slice(totalPages + 1);
            // Array of additional requests
            const additionalRequests = additionalPages.map((page) => {
              // function that will execute by async parallels
              return () => getProductsPack(page);
            });
            totalPages = realTotalPages;

            const additionalPack = await async.parallel(additionalRequests);

            const unpackedAdditionalPack = additionalPack.reduce(
              (total, currentPack) => {
                total.push(...currentPack);
                return total;
              },
              []
            );

            productsPack = [...productsPack, ...unpackedAdditionalPack];
          }

          return productsPack;
        })
        .catch((e) => {
          if (e.name === "SyntaxError") {
            throw new Error("Слишком много запросов к API, подождите немного");
          }
        });
    };
  });

  const fetchedProducts = await async.parallel(requests);

  // Unpacking array of objects arrays in one array with naming replace
  return fetchedProducts.reduce((totalList, currentPack) => {
    currentPack.map((product) => {
      product.name = nameFormatter.clearName(product.name, "site");
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

exports.getOrders = async () => {
  const WooCommerce = getWooCommerce();

  return await WooCommerce.getAsync(`orders?status=processing`).then(
    (response) => {
      return JSON.parse(response.body);
    }
  );
};
