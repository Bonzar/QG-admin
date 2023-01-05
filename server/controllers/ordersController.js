import async from "async";
import * as wooService from "../services/wooService.js";
import { clearName } from "../services/nameFormatter.js";
import WbProduct from "../models/WbProduct.js";
import ProductVariation from "../models/ProductVariation.js";
import { Ozon } from "../services/ozon.js";
import * as dbService from "../services/dbService.js";
import { Wildberries } from "../services/wildberries.js";
import { Yandex } from "../services/yandex.js";

//todo refactor callbacks

const formatOzonOrders = (ozonOrders, ozonDbProducts, dbVariations) => {
  return ozonOrders.map((ozonOrder) => {
    let order_status = "";
    switch (ozonOrder.status) {
      case "awaiting_packaging":
        order_status = "Новый";
        break;
      case "not_accepted":
        order_status = "Не принят";
        break;
      case "awaiting_deliver":
        order_status = "Собран";
        break;
      case "delivering":
        order_status = "Доставка";
        break;
    }

    return {
      order_number: ozonOrder.order_number,
      order_status,
      products: ozonOrder.products.map((product) => {
        const { dbVariation } = Ozon.getDbProductAndVariationForApiProduct(
          product,
          dbVariations,
          ozonDbProducts
        );

        return {
          name: dbVariation?.product.name,
          article: product.offer_id,
          quantity: product.quantity,
        };
      }),
    };
  });
};

const getAllOzonOrders = () => {
  return async
    .parallel({
      ozonTodayOrders: (callback) => {
        Ozon.getApiTodayOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      ozonOverdueOrders: (callback) => {
        Ozon.getApiOverdueOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      ozonDbProducts: (callback) => {
        Ozon.getDbProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbVariations: (callback) => {
        dbService
          .getAllVariations({}, ["product ozonProduct"])
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    })
    .then((results) => {
      const {
        ozonTodayOrders,
        ozonOverdueOrders,
        ozonDbProducts,
        dbVariations,
      } = results;

      const ozonOrdersFormat = formatOzonOrders(
        ozonTodayOrders,
        ozonDbProducts,
        dbVariations
      );
      const ozonOverdueOrdersFormat = formatOzonOrders(
        ozonOverdueOrders,
        ozonDbProducts,
        dbVariations
      );

      return {
        today: {
          status: ozonOrdersFormat.length > 0,
          orders: ozonOrdersFormat,
        },
        overdue: {
          status: ozonOverdueOrdersFormat.length > 0,
          orders: ozonOverdueOrdersFormat,
        },
      };
    });
};

const getYandexOrders = async (callback) => {
  try {
    const yandexOrders = await Yandex.getApiTodayOrders();

    const yandexOrdersFormatted = yandexOrders.map((yandexOrder) => {
      let order_status = "";
      switch (yandexOrder.substatus) {
        case "STARTED":
          order_status = "Новый";
          break;
        case "READY_TO_SHIP":
          order_status = "Собран";
          break;
        case "SHIPPED":
          order_status = "Доставка";
          break;
      }

      return {
        order_number: yandexOrder.id,
        order_status,
        products: yandexOrder.items.map((product) => {
          return {
            name: clearName(product.offerName),
            article: product.offerId,
            quantity: product.count,
          };
        }),
      };
    });
    callback(null, yandexOrdersFormatted);
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

const getWooOrders = async (callback) => {
  try {
    const wooOrders = await wooService.getOrders();
    const wooOrdersFormatted = wooOrders.map((wooOrder) => {
      let order_status = "";
      switch (wooOrder.status) {
        case "pending":
          order_status = "Ожидание";
          break;
        case "processing":
          order_status = "Обработка";
          break;
        case "on-hold":
          order_status = "Удержание";
          break;
        case "completed":
          order_status = "Завершен";
          break;
        case "cancelled":
          order_status = "Отменен";
          break;
        case "refunded":
          order_status = "Возврат";
          break;
        case "failed":
          order_status = "Не удался";
          break;
        case "trash":
          order_status = "Удален";
          break;
      }

      return {
        order_number: wooOrder.id,
        order_status,
        products: wooOrder.line_items.map((product) => {
          return {
            name: clearName(product.name, "site"),
            article: product.sku,
            quantity: product.quantity,
          };
        }),
      };
    });
    callback(null, wooOrdersFormatted);
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

const getWbOrders = () => {
  return async.waterfall([
    (callback) => {
      Wildberries.getApiNewOrders()
        .then((result) => callback(null, result))
        .catch((error) => callback(error, null));
    },
    (todayOrders, callback) => {
      const ordersInfoRequests = todayOrders.map((order) => {
        return (cb) => {
          async.waterfall(
            [
              (callback) => {
                WbProduct.findOne({
                  barcode: order.skus[0],
                }).exec(callback);
              },
              (wbProduct, callback) => {
                ProductVariation.findOne({ wbProduct })
                  .populate("product wbProduct")
                  .exec((error, variation) => {
                    if (error) {
                      console.error(error);
                      callback(error, null);
                      return;
                    }

                    callback(null, variation, wbProduct);
                  });
              },
              (variation, wbProduct, callback) => {
                try {
                  callback(null, {
                    order_number: order.id,
                    order_status: "Новый",
                    products: [
                      {
                        name: variation?.product.name ?? "",
                        article: wbProduct?.article ?? "",
                        quantity: 1,
                      },
                    ],
                  });
                } catch (e) {
                  console.log(e);
                  callback(e, null);
                }
              },
            ],
            cb
          );
        };
      });

      async.parallel(ordersInfoRequests, callback);
    },
  ]);
};

export const getOrdersList = (req, res) => {
  async
    .parallel({
      ozonOrders(callback) {
        getAllOzonOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      yandexOrders(callback) {
        getYandexOrders(callback);
      },
      wooOrders(callback) {
        getWooOrders(callback);
      },
      wbOrders(callback) {
        getWbOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    })
    .then((results) => {
      res.render("orders", {
        title: "Заказы на сегодня",
        allOrders: [
          {
            name: "Ozon",
            ...results.ozonOrders,
          },
          {
            name: "Yandex",
            today: {
              status: results.yandexOrders.length > 0,
              orders: results.yandexOrders,
            },
            overdue: {
              status: false,
              orders: [],
            },
          },
          {
            name: "WB",
            today: {
              status: results.wbOrders.length > 0,
              orders: results.wbOrders,
            },
            overdue: {
              status: false,
              orders: [],
            },
          },
          {
            name: "Site",
            today: {
              status: results.wooOrders.length > 0,
              orders: results.wooOrders,
            },
            overdue: {
              status: false,
              orders: [],
            },
          },
        ],
      });
    })
    .catch((error) => {
      return res.status(400).json({
        error,
        message: `Ошибка получения списка заказов – ${error.message}`,
      });
    });
};
