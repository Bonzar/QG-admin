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

exports.getProductList = async (tableFilters, callback) => {
  try {
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
          `products?per_page=10&page=${page}&order=asc${tableFilters}`
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
              throw new Error(
                "Слишком много запросов к API, подождите немного"
              );
            }
          });
      };
    });

    const fetchedProducts = await async.parallel(requests);

    // Unpacking array of objects arrays in one array with naming replace
    const result = fetchedProducts.reduce((totalList, currentPack) => {
      totalList.push(...currentPack);
      return totalList;
    }, []);

    if (!callback) {
      return result;
    }
    callback(null, result);
  } catch (e) {
    console.log(e);
    if (!callback) {
      return new Error(e);
    }
    callback(e, null);
  }
};

exports.getProductVariations = async (productId, callback) => {
  try {
    const WooCommerce = getWooCommerce();

    const result = await WooCommerce.getAsync(
      `products/${productId}/variations`
    ).then((response) => {
      return JSON.parse(response.body);
    });

    if (!callback) {
      return result;
    }
    callback(null, result);
  } catch (e) {
    console.log(e);
    if (!callback) {
      return new Error(e);
    }
    callback(e, null);
  }
};

exports.getProductVariationInfo = async (productId, variationId, callback) => {
  try {
    const WooCommerce = getWooCommerce();

    const result = await WooCommerce.getAsync(
      `products/${productId}/variations/${variationId}`
    ).then((response) => {
      return JSON.parse(response.body);
    });

    if (!callback) {
      return result;
    }
    callback(null, result);
  } catch (e) {
    console.log(e);
    if (!callback) {
      return new Error(e);
    }
    callback(e, null);
  }
};

exports.getProductInfo = async (productId, callback) => {
  try {
    const WooCommerce = getWooCommerce();

    const result = await WooCommerce.getAsync(`products/${productId}`).then(
      (response) => {
        return JSON.parse(response.body);
      }
    );

    if (!callback) {
      return result;
    }
    callback(null, result);
  } catch (e) {
    console.log(e);
    if (!callback) {
      throw e;
    }
    callback(e, null);
  }
};

exports.updateProduct = async (
  productType,
  variableId,
  id,
  updateData,
  callback
) => {
  try {
    const WooCommerce = getWooCommerce();

    let result;
    switch (productType) {
      case "simple":
        result = await WooCommerce.putAsync(`products/${id}`, updateData);
        break;
      case "variation":
        result = await WooCommerce.putAsync(
          `products/${variableId}/variations/${id}`,
          updateData
        );
        break;
      default:
        throw new Error("Product_type not valid");
    }

    if (!callback) {
      return result;
    }
    callback(null, result);
  } catch (e) {
    console.log(e);
    if (!callback) {
      throw e;
    }
    callback(e, null);
  }
};

exports.getOrders = async () => {
  const WooCommerce = getWooCommerce();

  return await WooCommerce.getAsync(`orders?status=processing`).then(
    (response) => {
      return JSON.parse(response.body);
    }
  );
};

const getConnectWooDataRequest = (
  filters,
  wooApiProduct,
  allDbVariations,
  connectWooDataResultFormatter
) => {
  return async () => {
    let wooDbProduct;
    // Search variation for market product from api
    const variation = allDbVariations.find(
      (variation) =>
        // Search market product in db for market product from api
        variation.wooProduct?.filter((variationWooDbProduct) => {
          const isMarketProductMatch =
            variationWooDbProduct.id === wooApiProduct.id;

          // find -> save market product
          if (isMarketProductMatch) {
            wooDbProduct = variationWooDbProduct;
          }

          return isMarketProductMatch;
        }).length > 0
    );

    const wooStock = wooApiProduct["stock_quantity"];

    // Filtration
    let isPassFilterArray = [];
    // by stock status
    switch (filters.stock_status) {
      // Filter only outofstock products (by FBS)
      case "outofstock":
        isPassFilterArray.push(wooStock <= 0);
        break;
    }

    // by actual (manual setup in DB)
    switch (filters.isActual) {
      case "notActual":
        isPassFilterArray.push(wooDbProduct?.isActual === false);
        break;
      case "all":
        isPassFilterArray.push(true);
        break;
      // Only actual by default
      default:
        isPassFilterArray.push(wooDbProduct?.isActual !== false);
    }

    if (!isPassFilterArray.every((pass) => pass)) return;

    return connectWooDataResultFormatter(
      variation,
      wooDbProduct,
      wooApiProduct,
      wooStock
    );
  };
};

exports.getConnectWooDataRequests = (
  filters,
  wooApiProducts,
  allDbVariations,
  connectWooDataResultFormatter
) => {
  const connectWooDataRequests = [];

  wooApiProducts.forEach((wooApiProduct) => {
    if (wooApiProduct.type === "simple") {
      connectWooDataRequests.push(
        getConnectWooDataRequest(
          filters,
          wooApiProduct,
          allDbVariations,
          connectWooDataResultFormatter
        )
      );
    } else {
      for (const wooApiProductVariation of wooApiProduct.product_variations) {
        connectWooDataRequests.push(
          getConnectWooDataRequest(
            filters,
            wooApiProductVariation,
            allDbVariations,
            connectWooDataResultFormatter
          )
        );
      }
    }
  });

  return connectWooDataRequests;
};
