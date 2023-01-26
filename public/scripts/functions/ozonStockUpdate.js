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
    .then((response) => response.json())
    .then((data) => {
      if (data.updateApiStock.updated !== true) {
        cell.textContent = oldValue;

        if (data.updateApiStock.error?.[0].code === "TOO_MANY_REQUESTS") {
          alert("Товар уже был недавно обновлен. Попоробуйте позже.");
        }
        const error = new Error("Ошибка при обновлении остатка Ozon");
        error.data = data.updateApiStock.error;
        throw error;
      }
      cell.textContent = newStockValue;

      return data;
    })
    .catch((error) => {
      console.error({ error });
    });
};
