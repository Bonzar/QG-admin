const ozonService = require("../services/ozonService");
const yandexService = require("../services/yandexService");
const wooService = require("../services/wooService");
const wbService = require("../services/wbService");
const { clearName } = require("../services/nameFormatter");
const async = require("async");

const WbProduct = require("../models/WbProduct");
const ProductVariation = require("../models/ProductVariation");

const formatOzonOrders = (ozonOrders) => {
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
        return {
          name: clearName(product.name),
          article: product.offer_id,
          quantity: product.quantity,
        };
      }),
    };
  });
};

async function getOzonOrders(callback) {
  try {
    const ozonOrders = await ozonService.getTodayOrders();

    const ozonOrdersFormatted = formatOzonOrders(ozonOrders);
    callback(null, ozonOrdersFormatted);
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
}

async function getOzonOverdueOrders(callback) {
  try {
    const ozonOverdueOrders = await ozonService.getOverdueOrders();

    const ozonOverdueOrdersFormatted = formatOzonOrders(ozonOverdueOrders);

    callback(null, ozonOverdueOrdersFormatted);
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
}

async function getYandexOrders(callback) {
  try {
    const yandexOrders = await yandexService.getApiTodayOrders();

    const yandexOrdersFormatted = yandexOrders.orders.map((yandexOrder) => {
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
}

async function getWooOrders(callback) {
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
}

async function getWbOrders(callback) {
  try {
    async.waterfall(
      [
        (callback) => {
          wbService.getApiTodayOrders(callback);
        },
        (todayOrders, callback) => {
          const ordersInfoRequests = todayOrders.map((order) => {
            return (cb) => {
              async.waterfall(
                [
                  (callback) => {
                    WbProduct.findOne({
                      barcode: order.barcode,
                    }).exec(callback);
                  },
                  (wbProduct, callback) => {
                    ProductVariation.findOne({ wbProduct })
                      .populate("product wbProduct")
                      .exec(callback);
                  },
                  (variation, callback) => {
                    try {
                      let order_status = "";
                      switch (order.status) {
                        case 0:
                          order_status = "Новый";
                          break;
                        case 1:
                          order_status = "Сборка";
                          break;
                      }

                      callback(null, {
                        order_number: order.orderId,
                        order_status,
                        products: [
                          {
                            name: variation?.product.name ?? "",
                            article: variation?.wbProduct.article ?? "",
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
      ],
      callback
    );
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
}

module.exports.getOrdersList = (req, res) => {
  try {
    async.parallel(
      {
        ozonOrders(callback) {
          getOzonOrders(callback);
        },
        ozonOverdueOrders(callback) {
          getOzonOverdueOrders(callback);
        },
        yandexOrders(callback) {
          getYandexOrders(callback);
        },
        wooOrders(callback) {
          getWooOrders(callback);
        },
        wbOrders(callback) {
          getWbOrders(callback);
        },
      },

      (err, results) => {
        if (err) {
          return res.status(400).json({
            message: "Ошибка получения списка заказов",
            code: err.code,
            status: err.response.status,
          });
        }

        res.render("orders", {
          title: "Заказы на сегодня",
          allOrders: [
            {
              name: "Ozon",
              today: {
                status: results.ozonOrders.length > 0,
                orders: results.ozonOrders,
              },
              overdue: {
                status: results.ozonOverdueOrders.length > 0,
                orders: results.ozonOverdueOrders,
              },
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
      }
    );
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: "Ошибка получения списка заказов",
      code: err.code,
      status: err.response?.status,
    });
  }
};
