import async from "async";
import { Ozon } from "../services/ozon.js";
import { Wildberries } from "../services/wildberries.js";
import { Yandex } from "../services/yandex.js";
import { Woocommerce } from "../services/woocommerce.js";

//todo refactor callbacks

const formatOzonOrders = (orders) => {
  return orders.map((order) => {
    let order_status = "";
    switch (order.status) {
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

    const productsRequests = order.products.map((orderProduct) => {
      return (callback) => {
        return Ozon._getDbProduct({
          article: orderProduct.offer_id,
        })
          .then((dbProduct) =>
            callback(null, {
              name: dbProduct?.variation?.product.name ?? "",
              article: orderProduct.offer_id,
              quantity: orderProduct.quantity,
            })
          )
          .catch((error) => callback(error, null));
      };
    });

    async.parallel(productsRequests);

    return (callback) => {
      async
        .parallel(productsRequests)
        .then((products) => {
          callback(null, {
            order_number: order.order_number,
            order_status,
            products,
          });
        })
        .catch((error) => callback(error, null));
    };
  });
};

const getAllOzonOrders = async () => {
  const todayOrders = await Ozon.getApiOrdersToday();
  const overdueOrders = await Ozon.getApiOrdersOverdue();

  const todayOrdersFormatRequests = formatOzonOrders(todayOrders);
  const overdueOrdersFormatRequests = formatOzonOrders(overdueOrders);

  return async.parallel({
    todayOrders: (callback) => {
      async.parallel(todayOrdersFormatRequests, callback);
    },
    overdueOrders: (callback) => {
      async.parallel(overdueOrdersFormatRequests, callback);
    },
  });
};

const getYandexOrders = async () => {
  const yandexOrders = await Yandex.getApiOrdersToday();

  const yandexOrdersFormatRequests = yandexOrders.map((order) => {
    let order_status = "";
    switch (order.substatus) {
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

    const productsRequests = order.items.map((orderProduct) => {
      return (callback) => {
        return Yandex._getDbProduct({
          sku: orderProduct.offerId,
        })
          .then((dbProduct) =>
            callback(null, {
              name: dbProduct?.variation?.product.name ?? "",
              article: orderProduct.offerId,
              quantity: orderProduct.count,
            })
          )
          .catch((error) => callback(error, null));
      };
    });

    return (callback) => {
      async
        .parallel(productsRequests)
        .then((products) => {
          callback(null, {
            order_number: order.id,
            order_status,
            products,
          });
        })
        .catch((error) => callback(error, null));
    };
  });

  return async.parallel(yandexOrdersFormatRequests);
};

const getWooOrders = async () => {
  const wooOrders = await Woocommerce.getOrdersProcessing();

  const wooOrdersFormatRequests = wooOrders.map((order) => {
    let order_status = "";
    switch (order.status) {
      case "pending":
        order_status = "Ожидание оплаты";
        break;
      case "processing":
        order_status = "Новый";
        break;
      case "bonzar-collected":
        order_status = "Собран";
        break;
      case "bonzar-sent":
        order_status = "Отправлен";
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

    const productsRequests = order.line_items.map((orderProduct) => {
      return (callback) => {
        const productId = orderProduct.parent_name
          ? orderProduct.variation_id
          : orderProduct.product_id;

        return Woocommerce._getDbProduct({
          id: productId,
        })
          .then((dbProduct) =>
            callback(null, {
              name:
                (dbProduct?.variation?.product.name ?? "") +
                (["3 мл", "10 мл"].includes(dbProduct?.variation?.volume)
                  ? ` - ${dbProduct?.variation?.volume}`
                  : ""),
              article: orderProduct.sku,
              quantity: orderProduct.quantity,
            })
          )
          .catch((error) => callback(error, null));
      };
    });

    return (callback) => {
      async
        .parallel(productsRequests)
        .then((products) => {
          callback(null, {
            order_number: order.id,
            order_status,
            products,
          });
        })
        .catch((error) => callback(error, null));
    };
  });

  return async.parallel(wooOrdersFormatRequests);
};

const getWbProductInOrderRequests = (orders) => {
  return orders.map((order) => {
    return (callback) =>
      Wildberries._getDbProduct({ sku: order.nmId })
        .then((dbProduct) =>
          callback(null, {
            order_number: order.id,
            order_status: "Новый",
            products: [
              {
                name: dbProduct?.variation.product.name ?? "",
                article: order.article ?? "",
                quantity: 1,
              },
            ],
          })
        )
        .catch((error) => callback(error, null));
  });
};

const getAllWbOrders = () => {
  return async.parallel({
    todayOrders: (callback) => {
      Wildberries.getApiOrdersNew().then((orders) => {
        const productInOrderRequests = getWbProductInOrderRequests(orders);

        async.parallel(productInOrderRequests, callback);
      });
    },
    overdueOrders: (callback) => {
      Wildberries.getApiOrdersReshipment().then((orders) => {
        const productInOrderRequests = getWbProductInOrderRequests(orders);

        async.parallel(productInOrderRequests, callback);
      });
    },
  });
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
        getYandexOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      wooOrders(callback) {
        getWooOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      wbOrders(callback) {
        getAllWbOrders()
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
            today: {
              status: results.ozonOrders.todayOrders.length > 0,
              orders: results.ozonOrders.todayOrders,
            },
            overdue: {
              status: results.ozonOrders.overdueOrders.length > 0,
              orders: results.ozonOrders.overdueOrders,
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
              status: results.wbOrders.todayOrders.length > 0,
              orders: results.wbOrders.todayOrders,
            },
            overdue: {
              status: results.wbOrders.overdueOrders.length > 0,
              orders: results.wbOrders.overdueOrders,
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
      console.error(error);
      return res.status(400).json({
        error,
        message: `Ошибка получения списка заказов – ${error.message}`,
      });
    });
};
