import { updateMarketplaceStock } from "./marketplaceStockUpdateListener.js";

const authToken = localStorage.getItem("authToken");

const ozonTable = document.querySelector("#ozon-stocks");

const ozonFetchUpdateFunction = async (
  cell,
  skuUpdate,
  newStockValue,
  oldValue
) => {
  return await fetch(
    `/projects/ozon/update_stock?id=${skuUpdate}&stock=${newStockValue}`,
    {
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
      },
    }
  )
    .then(async (response) => {
      if (response.ok && (await response.json()).result[0].updated === true) {
        cell.textContent = cell.querySelector(
          ".change-stock--input-number"
        ).value;
      } else {
        cell.textContent = oldValue;
      }
      return response;
    })
    .catch((error) => {
      console.log({ error });
    });
};

updateMarketplaceStock(ozonFetchUpdateFunction, ozonTable);
