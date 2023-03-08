import { Wildberries } from "./wildberries.js";
import { Woocommerce } from "./woocommerce.js";
import { Yandex } from "./yandex.js";
import { Ozon } from "./ozon.js";
import winston from "winston";

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
  return { woo: Woocommerce, wb: Wildberries, ozon: Ozon, yandex: Yandex };
};

export const getLogger = (serviceName) => {
  return winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: serviceName },
    transports: [
      //
      // - Write all logs with importance level of `error` or less to `error.log`
      // - Write all logs with importance level of `info` or less to `combined.log`
      //
      new winston.transports.File({
        filename: "error.log",
        level: "error",
      }),
      new winston.transports.File({ filename: "combined.log" }),
    ],
  });
}

export const volumeSortRating = {
  "3 мл": 70,
  "6 мл": 60,
  "10 мл": 50,
  "60 мл": 40,
  "120 мл": 30,
  Набор: 20,
  Стикеры: 10,
};
