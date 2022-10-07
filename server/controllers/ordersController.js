const ozonService = require("../services/ozonService");
const yandexService = require("../services/yandexService");
const wooService = require("../services/wooService");
const { clearName } = require("../services/nameFormatter");
const async = require("async");

module.exports.getOrdersList = async (req, res) => {
  const formatOzonOrders = (ozonOrders) => {
    return ozonOrders.map((ozonOrder) => {
      return {
        order_number: ozonOrder.order_number,
        order_status: ozonOrder.status,
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
      const yandexOrders = await yandexService.getTodayOrders();

      const yandexOrdersFormatted = yandexOrders.orders.map((yandexOrder) => {
        return {
          order_number: yandexOrder.id,
          order_status: yandexOrder.substatus,
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
        return {
          order_number: wooOrder.id,
          order_status: wooOrder.status,
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

  try {
    await async.parallel(
      {
        ozonOrders(callback) {
          getOzonOrders(callback);
        },
        ozonOverdueOrders(callback) {
          getOzonOverdueOrders(callback);
        },
        YandexOrders(callback) {
          getYandexOrders(callback);
        },
        WooOrders(callback) {
          getWooOrders(callback);
        },
      },

      (errors, results) => {
        if (errors) {
          return res
            .status(400)
            .json({ message: "Ошибка получения списка заказов", errors });
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
                status: results.YandexOrders.length > 0,
                orders: results.YandexOrders,
              },
              overdue: {
                status: false,
                orders: [],
              },
            },
            {
              name: "Site",
              today: {
                status: results.WooOrders.length > 0,
                orders: results.WooOrders,
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
  } catch (e) {
    console.log(e);
    res
      .status(400)
      .json({ message: "Ошибка при получении списка заказов.", error: e });
  }
};
