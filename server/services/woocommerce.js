import WooCommerceAPI from "woocommerce-api";
import async from "async";
import { Marketplace } from "./marketplace.js";
import WooProduct from "../models/WooProduct.js";
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

  // INSTANCE METHODS
  async getApiProduct() {
    const product = await this.getDbProduct();
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
    const product = await this.getDbProduct();

    return Woocommerce.updateApiProduct(
      product.id,
      product.type,
      updateData,
      product.parentVariable?.id
    );
  }

  async addUpdateProduct(newData) {
    return super.addUpdateProduct(newData, (newStock) =>
      this.updateApiStock(newStock)
    );
  }

  // CLASS METHODS
  static async checkIdentifierExistsInApi(newProductData) {
    const allApiProducts = await this.getApiProducts();

    const isProductExistsOnMarketplace = !!allApiProducts[newProductData.id];

    if (!isProductExistsOnMarketplace) {
      throw new Error("Идентификатор товара не существует в базе маркетплейса");
    }
  }

  static connectDbApiData(dbProducts, apiProducts) {
    for (const apiProduct of Object.values(apiProducts)) {
      apiProduct.fbsStock = apiProduct.stock_quantity;
    }

    for (const dbProduct of dbProducts) {
      const apiProduct = apiProducts[dbProduct.id];
      if (!apiProduct) {
        continue;
      }

      apiProduct.dbInfo = dbProduct;
    }

    return apiProducts;
  }

  static async getApiProducts() {
    // Setup optimal count requests pages
    let totalPages = 30;

    // Array of page numbers for requests
    const pages = [...Array.from({ length: totalPages + 1 }).keys()].slice(1);

    // Array of request functions for optimal count requests pages
    const requests = pages.map((currentPage) => {
      return async function getProductsPack(page = currentPage) {
        // Request it self
        return await woocommerceAPI
          .getAsync(`products?per_page=10&page=${page}&order=asc`)
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

    const apiProducts = {};
    fetchedProducts.forEach((productPack) => {
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

    return apiProducts;
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

  static async getApiProduct(productId, productType, variableId = null) {
    let apiProduct;

    switch (productType) {
      case "simple":
        apiProduct = await this.getApiSimpleProductInfo(productId);
        break;
      case "variation":
        apiProduct = await this.getApiProductVariationInfo(
          variableId,
          productId
        );
        break;
    }

    return { [apiProduct.id]: apiProduct };
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

  static getDbVariableProducts(filter) {
    return WooProductVariable.find(filter);
  }

  static getProcessingOrders = () => {
    return woocommerceAPI
      .getAsync(`orders?per_page=100&status=processing`)
      .then((response) => {
        return JSON.parse(response.body);
      });
  };

  static getDbProductById(id) {
    return super.getDbProductById(id).populate("parentVariable");
  }

  static getDbProducts(filter = {}) {
    return super.getDbProducts(filter).populate("parentVariable");
  }

  static getDbProduct(filter = {}) {
    return super.getDbProduct(filter).populate("parentVariable");
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
    } else {
      marketProductDetails.parentVariable = undefined;
    }

    return marketProductDetails;
  }
}
