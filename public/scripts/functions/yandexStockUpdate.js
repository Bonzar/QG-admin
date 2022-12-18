export default async (cell, skuUpdate, newStockValue, oldValue, authToken) => {
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
    .catch((error) => console.error(error));
};
