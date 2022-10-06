import { updateMarketplaceStock } from "./marketplaceStockUpdateListener.js";

const ozonTable = document.querySelector("#ozon-stocks");

const ozonFetchUpdateFunction = async (
  cell,
  skuUpdate,
  newStockValue,
  oldValue,
  authToken
) => {
  return await fetch(
    `/stocks/ozon/update_stock?id=${skuUpdate}&stock=${newStockValue}`,
    {
      method: "post",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  )
    .then(async (response) => {
      const responseData = await response.json();

      if (responseData.result[0].updated === true) {
        cell.textContent = cell.querySelector(
          ".change-stock--input-number"
        ).value;
      } else {
        if (responseData.result[0].errors?.[0].code === "TOO_MANY_REQUESTS") {
          alert("Товар уже был недавно обновлен. Попоробуйте позже.");
        }

        cell.textContent = oldValue;
      }
      return response;
    })
    .catch((error) => {
      console.log({ error });
    });
};

updateMarketplaceStock(ozonFetchUpdateFunction, ozonTable);
