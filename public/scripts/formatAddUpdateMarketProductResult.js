export const formatAddUpdateMarketProductResult = (results, marketType) => {
  let isMarketProductUpdated = !!results.marketProductUpdate;
  let isVariationUpdated = !!results.variationUpdate;
  let isFbsStockUpdated = false;
  let fbsStockUpdateError = null;

  let fbsStockUpdate = results.fbsStockUpdate;
  if (fbsStockUpdate) {
    switch (marketType) {
      case "wb":
        isFbsStockUpdated = !fbsStockUpdate.error;
        if (!isFbsStockUpdated) {
          fbsStockUpdateError = fbsStockUpdate.errorText;
        }
        break;
      case "ozon":
        isFbsStockUpdated = fbsStockUpdate.result[0].updated;
        if (!isFbsStockUpdated) {
          fbsStockUpdateError = fbsStockUpdate.result[0].errors
            .map((error) => error.message)
            .join(". ");
        }
        break;
      case "yandex":
        isFbsStockUpdated = fbsStockUpdate.status === "OK";
        if (!isFbsStockUpdated) {
          fbsStockUpdateError = "Ошибка обновления остатков";
        }
        break;
      case "woo":
        isFbsStockUpdated = fbsStockUpdate.statusCode === 200;
        if (!isFbsStockUpdated) {
          fbsStockUpdateError = "Ошибка обновления остатков";
        }
        break;
    }
  }

  const status = [
    isMarketProductUpdated,
    isVariationUpdated,
    isFbsStockUpdated,
  ].every((status) => status);

  return {
    status,
    message: `Продукт маркетплейса: ${
      isMarketProductUpdated ? "Обновлен" : "Не обновлен"
    }\nВариация: ${
      isVariationUpdated ? "Обновлена" : "Не обновлена"
    }\nОстаток FBS: ${
      isFbsStockUpdated ? "Обновлен" : "Не обновлен: " + fbsStockUpdateError
    }`,
  };
};
