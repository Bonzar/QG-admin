import { Wildberries } from "./wildberries.js";
import { Woocommerce } from "./woocommerce.js";
import { Yandex } from "./yandex.js";
import { Ozon } from "./ozon.js";

export const filterMarketProducts = (products, filters) => {
  let filtratedProducts = products;

  // By stock status
  switch (filters.stock_status) {
    // Filter only outofstock products (by FBM and FBS)
    case "outofstock":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.fbsStock <= 0 && product.fbmStock <= 0
      );
      break;
    // Filter only out-of-stock products (by FBS)
    case "outofstockFBS":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.fbsStock <= 0
      );
      break;
    // Filter only out-of-stock products (by FBM)
    case "outofstockFBM":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.fbmStock <= 0
      );
      break;
    // Filter only in-stock on FBS products
    case "instockFBS":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.fbsStock > 0
      );
      break;
    // Filter only in-stock on FBW products
    case "instockFBM":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.fbmStock > 0
      );
      break;
    // Filter only in-stock on FBW or FBS products (some of them)
    case "instockSome":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.fbsStock > 0 || product.fbmStock > 0
      );
      break;
  }
  // By actual (manual setup in DB)
  switch (filters.isActual) {
    case "notActual":
      filtratedProducts = filtratedProducts.filter(
        (product) => product.dbInfo.isActual === false
      );
      break;
    case "all":
      break;
    // Only actual or not specified by default
    default:
      filtratedProducts = filtratedProducts.filter(
        (product) => product.dbInfo.isActual !== false
      );
  }

  return filtratedProducts;
};

export const getMarketplaceClasses = () => {
  return { wb: Wildberries, woo: Woocommerce, yandex: Yandex, ozon: Ozon };
};
