import { updateMarketplaceStock } from "./marketplaceStockUpdateListener.js";

const yandexTable = document.querySelector("#yandex-stocks");

const yandexFetchUpdateFunction = async (
  cell,
  skuUpdate,
  newStockValue,
  oldValue,
  authToken
) => {
  return await fetch(
    `/projects/yandex/update_stock?sku=${skuUpdate}&stock=${newStockValue}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  )
    .then((response) => {
      if (response.ok) {
        cell.textContent = cell.querySelector(
          ".change-stock--input-number"
        ).value;
      } else {
        cell.textContent = oldValue;
      }

      return response;
    })
    .catch((error) => console.log(error));
};

updateMarketplaceStock(yandexFetchUpdateFunction, yandexTable);
