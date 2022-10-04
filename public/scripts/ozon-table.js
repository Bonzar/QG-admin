import { updateMarketplaceStock } from "./marketplaceStockUpdateListener.js";

const ozonTable = document.querySelector("#ozon-stocks");

const ozonFetchUpdateFunction = (cell, skuUpdate, newStockValue, oldValue) => {
  fetch(`/projects/ozon/update_stock?id=${skuUpdate}&stock=${newStockValue}`)
    .then(async (response) => {
      if (response.ok && (await response.json()).result[0].updated === true) {
        cell.textContent = cell.querySelector(
          ".change-stock--input-number"
        ).value;
      } else {
        cell.textContent = oldValue;
      }
    })
    .catch((error) => console.log(error));
};

updateMarketplaceStock(ozonFetchUpdateFunction, ozonTable);
