export default async (cell, skuUpdate, newStockValue, oldValue, authToken) => {
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
        cell.textContent = newStockValue;
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
