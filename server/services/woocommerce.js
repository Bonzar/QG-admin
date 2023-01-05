import WooCommerceAPI from "woocommerce-api";
import async from "async";
import { Marketplace } from "./marketplace.js";
import WooProduct from "../models/WooProduct.js";
import * as dbService from "./dbService.js";
import WooProductVariable from "../models/WooProductVariable.js";

const woocommerceAPI = WooCommerceAPI({
  url: "https://queridosglitters.ru/",
  consumerKey: process.env.WOO_CLIENTID,
  consumerSecret: process.env.WOO_APIKEY,
  wpAPI: true,
  version: "wc/v3",
});

export class Woocommerce extends Marketplace {
  static marketProductSchema = WooProduct;

  /**
   * INSTANCE METHODS
   */
  async getApiProduct() {
    const product = await this.getDbData();
    return Woocommerce.getApiProduct(
      product.id,
      product.type,
      product.parentVariable?.id
    );
  }

  async updateApiStock(newStock) {
    return this.updateApiProduct({ stock_quantity: newStock });
  }

  async updateApiProduct(updateData) {
    const product = await this.getDbData();

    return Woocommerce.updateApiProduct(
      product.id,
      product.type,
      updateData,
      product.parentVariable?.id
    );
  }

  async addUpdateProduct(newData) {
    if (newData.parentVariable) {
      newData.parentVariable = await WooProductVariable.findOne({
        id: newData.parentVariable,
      });
    } else {
      newData.parentVariable = undefined;
    }

    return super.addUpdateProduct(newData, (newStock) =>
      this.updateApiStock(newStock)
    );
  }

  /**
   * CLASS METHODS
   */
  static async getProducts(
    filters,
    connectWooDataResultFormatter,
    allDbVariations
  ) {
    const wooData = await async.parallel({
      wooApiProducts: (callback) => {
        this.getApiProducts("")
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      wooDbProducts: (callback) => {
        this.getDbProducts()
          .populate("parentVariable")
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbVariations: (callback) => {
        if (!allDbVariations) {
          dbService
            .getAllVariations({}, [
              {
                path: "wooProduct",
                populate: { path: "parentVariable" },
              },
              "product",
            ])
            .then((result) => callback(null, result))
            .catch((error) => callback(error, null));
          return;
        }

        callback(null, allDbVariations);
      },
    });

    return async.parallel(
      this.#getConnectWooDataRequests(
        filters,
        wooData.wooApiProducts,
        wooData.wooDbProducts,
        wooData.dbVariations,
        connectWooDataResultFormatter
      )
    );
  }

  static async getApiProducts(tableFilters) {
    // Setup optimal count requests pages
    let totalPages = 30;

    // Array of page numbers for requests
    const pages = [...Array.from({ length: totalPages + 1 }).keys()].slice(1);

    // Array of request functions for optimal count requests pages
    const requests = pages.map((currentPage) => {
      return async function getProductsPack(page = currentPage) {
        // Request it self
        return await woocommerceAPI
          .getAsync(
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
    return fetchedProducts.reduce((totalList, currentPack) => {
      totalList.push(...currentPack);
      return totalList;
    }, []);
  }

  static getApiProductVariationInfo(variableId, productId) {
    return woocommerceAPI
      .getAsync(`products/${variableId}/variations/${productId}`)
      .then((response) => {
        return JSON.parse(response.body);
      });
  }

  static getApiSimpleProductInfo(productId) {
    return woocommerceAPI.getAsync(`products/${productId}`).then((response) => {
      return JSON.parse(response.body);
    });
  }

  static getApiProduct(productId, productType, variableId = null) {
    switch (productType) {
      case "simple":
        return this.getApiSimpleProductInfo(productId);
      case "variation":
        return this.getApiProductVariationInfo(variableId, productId);
    }
  }

  static updateApiSimpleProduct(productId, updateData) {
    return woocommerceAPI
      .putAsync(`products/${productId}`, updateData)
      .then((response) => {
        return JSON.parse(response.body);
      });
  }

  static updateApiProductVariation(productId, variableId, updateData) {
    return woocommerceAPI
      .putAsync(`products/${variableId}/variations/${productId}`, updateData)
      .then((response) => {
        return JSON.parse(response.body);
      });
  }

  static updateApiProduct(
    productId,
    productType,
    updateData,
    variableId = null
  ) {
    switch (productType) {
      case "simple":
        return this.updateApiSimpleProduct(productId, updateData);
      case "variation":
        return this.updateApiProductVariation(
          productId,
          variableId,
          updateData
        );
    }
  }

  static getProcessingOrders = () => {
    return woocommerceAPI
      .getAsync(`orders?per_page=100&status=processing`)
      .then((response) => {
        return JSON.parse(response.body);
      });
  };

  static getDbProductAndVariationForApiProduct(
    apiProduct,
    allDbVariations,
    wooDbProducts
  ) {
    let dbProduct;
    // Search variation for market product from api
    const dbVariation = allDbVariations.find(
      (variation) =>
        // Search market product in db for market product from api
        variation.wooProduct?.filter((variationWooDbProduct) => {
          const isMarketProductMatch =
            variationWooDbProduct.id === apiProduct.id;
          // find -> save market product
          if (isMarketProductMatch) {
            dbProduct = variationWooDbProduct;
          }

          return isMarketProductMatch;
        }).length > 0
    );

    if (!dbProduct) {
      // Search fetched product from ozon in DB
      dbProduct = wooDbProducts.find(
        (wooDbProduct) => wooDbProduct.id === apiProduct.id
      );
    }

    return { dbVariation, dbProduct };
  }

  static #getConnectWooDataRequest = (
    filters,
    wooApiProduct,
    wooDbProducts,
    allDbVariations,
    connectWooDataResultFormatter
  ) => {
    return async () => {
      const { dbVariation, dbProduct } =
        this.getDbProductAndVariationForApiProduct(
          wooApiProduct,
          allDbVariations,
          wooDbProducts
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
          isPassFilterArray.push(dbProduct?.isActual === false);
          break;
        case "all":
          isPassFilterArray.push(true);
          break;
        // Only actual by default
        default:
          isPassFilterArray.push(dbProduct?.isActual !== false);
      }

      if (!isPassFilterArray.every((pass) => pass)) return;

      return connectWooDataResultFormatter(
        dbVariation,
        dbProduct,
        wooApiProduct,
        wooStock
      );
    };
  };

  static #getConnectWooDataRequests = (
    filters,
    wooApiProducts,
    wooDbProducts,
    allDbVariations,
    connectWooDataResultFormatter
  ) => {
    const connectWooDataRequests = [];

    wooApiProducts.forEach((wooApiProduct) => {
      if (wooApiProduct.type === "simple") {
        connectWooDataRequests.push(
          this.#getConnectWooDataRequest(
            filters,
            wooApiProduct,
            wooDbProducts,
            allDbVariations,
            connectWooDataResultFormatter
          )
        );
      } else {
        for (const wooApiProductVariation of wooApiProduct.product_variations) {
          connectWooDataRequests.push(
            this.#getConnectWooDataRequest(
              filters,
              wooApiProductVariation,
              wooDbProducts,
              allDbVariations,
              connectWooDataResultFormatter
            )
          );
        }
      }
    });

    return connectWooDataRequests;
  };

  static getDbProductById(id) {
    return super.getDbProductById(id).populate("parentVariable");
  }

  static getMarketProductDetails(marketProductData) {
    const marketProductDetails = super.getMarketProductDetails(
      marketProductData
    );

    if (marketProductData.type) {
      marketProductDetails.type = marketProductData.type;
    }
    if (marketProductData.id) {
      marketProductDetails.id = marketProductData.id;
    }

    return marketProductDetails;
  }
}
