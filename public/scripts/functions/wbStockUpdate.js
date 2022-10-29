export default async (
  cell,
  barcodeUpdate,
  newStockValue,
  oldValue,
  authToken
) => {
  return await fetch(
    `/stocks/wb/update_stock?barcode=${barcodeUpdate}&stock=${newStockValue}`,
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
