import { updateMarketplaceStock } from "./marketplaceStockUpdateListener.js";

const yandexTable = document.querySelector("#yandex-stocks");

const yandexFetchUpdateFunction = (
  cell,
  skuUpdate,
  newStockValue,
  oldValue
) => {
  fetch(`/projects/yandex/update_stock?sku=${skuUpdate}&stock=${newStockValue}`)
    .then((response) => {
      if (response.ok) {
        cell.textContent = cell.querySelector(
          ".change-stock--input-number"
        ).value;
      } else {
        cell.textContent = oldValue;
      }
    })
    .catch((error) => console.log(error));
};

updateMarketplaceStock(yandexFetchUpdateFunction, yandexTable);
