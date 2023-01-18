import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import https from "https";
import async from "async";
import { Marketplace } from "./marketplace.js";
import WooProduct from "../models/WooProduct.js";
import WooProductVariable from "../models/WooProductVariable.js";

// noinspection JSPotentiallyInvalidConstructorUsage
const woocommerceAPI = new WooCommerceRestApi.default({
  url: "https://queridosglitters.ru/",
  consumerKey: process.env.WOO_CLIENTID,
  consumerSecret: process.env.WOO_APIKEY,
  version: "wc/v3",
  axiosConfig: { httpsAgent: new https.Agent({ keepAlive: true }) },
});

export class Woocommerce extends Marketplace {
  static marketProductSchema = WooProduct;

  // INSTANCE METHODS
  async _getApiProduct() {
    const product = await this._getDbProduct();

    return Woocommerce.#getApiProductByType(
      product.id,
      product.type,
      product.parentVariable?.id
    );
  }

  async #updateApiStock(newStock) {
    const product = await this._getDbProduct();

    return Woocommerce.#updateApiProductStock(
      product.id,
      product.type,
      +newStock,
      product.parentVariable?.id
    );
  }

  // async updateApiProduct(updateData) {
  //   const product = await this._getDbProduct();
  //
  //   return Woocommerce.updateApiProduct(
  //     product.id,
  //     product.type,
  //     updateData,
  //     product.parentVariable?.id
  //   );
  // }

  async addUpdateProduct(newData) {
    return super.addUpdateProduct(newData, (newStock) =>
      this.#updateApiStock(newStock)
    );
  }

  // CLASS METHODS
  static async checkIdentifierExistsInApi(newProductData) {
    let isProductExistsOnMarketplace = true;

    if (newProductData.id) {
      const allApiProductsData = await this._getApiProducts();

      isProductExistsOnMarketplace =
        !!allApiProductsData.productsInfo[newProductData.id];
    }

    if (!isProductExistsOnMarketplace) {
      throw new Error("Идентификатор товара не существует в базе маркетплейса");
    }
  }

  static _connectDbApiData(dbProducts, apiProductsData) {
    const {
      productsInfo: apiProducts,
      productsStocks: { fbsReserves },
    } = apiProductsData;

    const connectedProducts = {};

    for (const [apiProductID, apiProductData] of Object.entries(apiProducts)) {
      connectedProducts[apiProductID] = {
        apiData: { ...apiProductData },
        fbsStock: apiProductData.stock_quantity,
      };
    }

    for (const fbsReserve of fbsReserves) {
      for (const fbsReserveProduct of fbsReserve.line_items) {
        const connectedProduct =
          connectedProducts[
            fbsReserveProduct.parent_name
              ? fbsReserveProduct.variation_id
              : fbsReserveProduct.product_id
          ];
        if (!connectedProduct) {
          continue;
        }

        if (!Number.isFinite(connectedProduct.fbsReserve)) {
          connectedProduct.fbsReserve = fbsReserveProduct.quantity;
        } else {
          connectedProduct.fbsReserve += fbsReserveProduct.quantity;
        }
      }
    }

    for (const dbProduct of dbProducts) {
      const connectedProduct = connectedProducts[dbProduct.id];
      if (!connectedProduct) {
        continue;
      }

      connectedProduct.dbInfo = dbProduct;
    }

    return connectedProducts;
  }

  static async _getApiProducts() {
    // Setup optimal count requests pages
    let totalPages = 25;

    // Array of page numbers for requests
    const pages = [...Array.from({ length: totalPages + 1 }).keys()].slice(1);

    // Array of request functions for optimal count requests pages
    const requests = pages.map((currentPage) => {
      return async function getProductsPack(page = currentPage) {
        // Request it self
        return await woocommerceAPI
          .get("products", { per_page: 10, page, order: "asc" })
          .then(async (response) => {
            let productsPack = response.data;

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

            throw e;
          });
      };
    });

    const apiData = await async.parallel({
      fetchedProducts: (callback) => {
        const getApiProducts = () => {
          return async.parallel(requests);
        };

        const getApiProductsCached = this._makeCachingForTime(
          getApiProducts,
          [],
          "WOO-GET-API-PRODUCTS",
          5 * 60 * 1000
        );

        return getApiProductsCached()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      newOrders: (callback) => {
        this.getOrdersWithReserveProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });

    const apiProducts = {};
    apiData.fetchedProducts.forEach((productPack) => {
      productPack.forEach((product) => {
        switch (product.type) {
          case "simple":
            apiProducts[product.id] = product;
            break;
          case "variable":
            product["product_variations"].forEach((productVariation) => {
              apiProducts[productVariation.id] = {
                ...productVariation,
                parentId: product.id,
                type: "variation",
              };
            });
            break;
        }
      });
    });

    return {
      productsInfo: apiProducts,
      productsStocks: {
        fbsReserves: apiData.newOrders,
      },
    };
  }

  static #getApiProductVariationInfo(variableId, productId) {
    return woocommerceAPI
      .get(`products/${variableId}/variations/${productId}`)
      .then((response) => {
        return response.data;
      });
  }

  static #getApiProductSimpleInfo(productId) {
    return woocommerceAPI.get(`products/${productId}`).then((response) => {
      return response.data;
    });
  }

  static async #getApiProductByType(productId, productType, variableId = null) {
    const getApiProductRequest = (productId, productType, variableId) => {
      switch (productType) {
        case "simple":
          return this.#getApiProductSimpleInfo(productId);
        case "variation":
          return this.#getApiProductVariationInfo(variableId, productId);
      }
    };

    const apiData = await async.parallel({
      apiProduct: (callback) => {
        const getApiProductsCached = this._makeCachingForTime(
          getApiProductRequest,
          [productId, productType, variableId],
          "WOO-GET-API-PRODUCT",
          5 * 60 * 1000
        );

        return getApiProductsCached()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      newOrders: (callback) => {
        this.getOrdersWithReserveProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });

    return {
      productsInfo: { [apiData.apiProduct.id]: apiData.apiProduct },
      productsStocks: { fbsReserves: apiData.newOrders },
    };
  }

  static #updateApiProductSimple(productId, updateData) {
    return woocommerceAPI
      .put(`products/${productId}`, updateData)
      .then((response) => {
        return response.data;
      });
  }

  static #updateApiProductVariation(productId, variableId, updateData) {
    return woocommerceAPI
      .put(`products/${variableId}/variations/${productId}`, updateData)
      .then((response) => {
        return response.data;
      });
  }

  static #updateApiProduct(
    productId,
    productType,
    updateData,
    variableId = null
  ) {
    // clear cache on product update
    this._clearCache("WOO-GET-API-PRODUCT");
    // this one was cleared by previous, here for code readability
    this._clearCache("WOO-GET-API-PRODUCTS");

    switch (productType) {
      case "simple":
        return this.#updateApiProductSimple(productId, updateData);
      case "variation":
        return this.#updateApiProductVariation(
          productId,
          variableId,
          updateData
        );
    }
  }

  static async #updateApiProductStock(
    productId,
    productType,
    newStock,
    variableId = null
  ) {
    const processingOrders = await this.getOrdersWithReserveProducts(false);

    for (const processingOrder of processingOrders) {
      for (const orderProduct of processingOrder.line_items) {
        if (
          productId ===
          (orderProduct.parent_name
            ? orderProduct.variation_id
            : orderProduct.product_id)
        ) {
          newStock -= orderProduct.quantity;
        }
      }
    }

    return this.#updateApiProduct(
      productId,
      productType,
      { stock_quantity: newStock },
      variableId
    );
  }

  static getDbVariableProducts(filter) {
    return WooProductVariable.find(filter);
  }

  static getOrdersProcessing(useCache = true) {
    const getProcessingOrdersRequest = () =>
      woocommerceAPI
        .get(`orders`, {
          per_page: 100,
          status: [
            "processing",
            "on-hold",
            "pending",
            "bonzar-collected",
            "bonzar-sent",
          ],
        })
        .then((response) => {
          // filter pending orders with payment_method not after confirm
          return response.data.filter(
            (order) =>
              !(
                order.status === "pending" &&
                order.date_created === order.date_modified
              )
          );
        });

    const getProcessingOrdersRequestCached = this._makeCachingForTime(
      getProcessingOrdersRequest,
      [],
      "WOO-GET-PROCESSING-ORDERS",
      5 * 60 * 1000,
      !useCache
    );

    return getProcessingOrdersRequestCached();
  }

  static getOrdersWithReserveProducts(useCache = true) {
    const getOrdersWithReserveProductsRequest = () =>
      woocommerceAPI
        .get(`orders`, {
          per_page: 100,
          status: ["processing", "on-hold", "pending"],
        })
        .then((response) => {
          // filter pending orders with payment_method not after confirm
          return response.data.filter(
            (order) =>
              !(
                order.status === "pending" &&
                order.date_created === order.date_modified
              )
          );
        });

    const getOrdersWithReserveProductsRequestCached = this._makeCachingForTime(
      getOrdersWithReserveProductsRequest,
      [],
      "WOO-GET-ORDERS-WITH-RESERVE-PRODUCTS",
      5 * 60 * 1000,
      !useCache
    );

    return getOrdersWithReserveProductsRequestCached();
  }

  static _getDbProductById(id) {
    return super._getDbProductById(id).populate("parentVariable");
  }

  static _getDbProducts(filter = {}) {
    return super._getDbProducts(filter).populate("parentVariable");
  }

  static _getDbProduct(filter = {}) {
    return super._getDbProduct(filter).populate("parentVariable");
  }

  static async getMarketProductDetails(marketProductData) {
    const marketProductDetails = await super.getMarketProductDetails(
      marketProductData
    );

    if (marketProductData.type) {
      marketProductDetails.type = marketProductData.type;
    }
    if (marketProductData.id) {
      marketProductDetails.id = marketProductData.id;
    }
    if (marketProductData.parentVariable) {
      marketProductDetails.parentVariable = await WooProductVariable.findOne({
        id: marketProductData.parentVariable,
      });
    } else if (marketProductDetails.parentVariable === "") {
      marketProductDetails.parentVariable = undefined;
    }

    return marketProductDetails;
  }
}
