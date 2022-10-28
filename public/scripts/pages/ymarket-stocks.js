import { updateMarketplaceStock } from "../functions/registerMarketplaceStockUpdateListener.js";

const yandexTable = document.querySelector("#yandex-stocks");

const yandexFetchUpdateFunction = async (
  cell,
  skuUpdate,
  newStockValue,
  oldValue,
  authToken
) => {
  return await fetch(
    `/stocks/yandex/update_stock?sku=${skuUpdate}&stock=${newStockValue}`,
    {
      method: "post",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  )
    .then((response) => {
      if (response.ok) {
        cell.textContent = newStockValue;
      } else {
        cell.textContent = oldValue;
      }

      return response;
    })
    .catch((error) => console.log(error));
};

updateMarketplaceStock(yandexFetchUpdateFunction, yandexTable);
