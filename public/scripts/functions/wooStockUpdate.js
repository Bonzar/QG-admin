export default async (cell, updateBy, newStockValue, oldValue, authToken) => {
  return await fetch(
    `/stocks/woo/update_stock?updateBy=${updateBy}&stock=${newStockValue}`,
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
