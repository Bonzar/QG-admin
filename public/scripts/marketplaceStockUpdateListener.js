export const updateMarketplaceStock = (fetchUpdateFunction, tableHtml) => {
  const updateStockListener = function (e) {
    const cell = e.target;
    if (
      cell.classList.value.includes("col--fbs") &&
      cell.nodeName === "TD" &&
      !cell.querySelector(".change-stock--form")
    ) {
      const oldValue = cell.textContent;

      cell.innerHTML = `<form class="change-stock--form">
          <input class="change-stock--submit-button" type="button" value="OK">
          <input class="change-stock--input-number" name="stock" type="number" min="0" required value="${cell.textContent}">
        </form>`;

      const form = cell.querySelector(".change-stock--form");
      const submitButton = form.querySelector(".change-stock--submit-button");

      submitButton.addEventListener(
        "click",
        function (e) {
          const newStockValue = form.querySelector(
            ".change-stock--input-number"
          ).value;
          const skuUpdate =
            cell.parentElement.querySelector(".col--sku").textContent;

          document.removeEventListener("click", exitUpdateStockListener);

          fetchUpdateFunction(cell, skuUpdate, newStockValue, oldValue);
        },
        { once: true }
      );

      const exitUpdateStockListener = (e) => {
        if (e.target !== cell && e.target.nodeName !== "INPUT") {
          cell.textContent = oldValue;
          document.removeEventListener("click", exitUpdateStockListener);
        }
      };

      document.addEventListener("click", exitUpdateStockListener);
    }
  };

  tableHtml.addEventListener("click", updateStockListener);
};
