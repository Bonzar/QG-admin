const fbsCells = document.querySelector("#yandex-stocks");

const updateStockListener = function (e) {
  const cell = e.target;
  if (
    cell.classList.value.includes("col--fbs") &&
    cell.nodeName === "TD" &&
    !cell.querySelector(".change-stock--form")
  ) {
    cell.innerHTML = `<form class="change-stock--form">
          <input class="change-stock--submit-button" type="submit" value="OK">
          <input class="change-stock--input-number" name="stock" type="number" min="0" required value="${cell.textContent}">
        </form>`;

    const form = cell.querySelector(".change-stock--form");
    form.addEventListener(
      "submit",
      function (e) {
        const newStockValue = e.target.querySelector(
          ".change-stock--input-number"
        ).value;
        const skuUpdate =
          cell.parentElement.querySelector(".col--sku").textContent;

        document.removeEventListener("click", exitUpdateStockListener);

        cell.innerHTML = newStockValue;
        fetch(
          `/projects/yandex/update_stock?sku=${skuUpdate}&stock=${newStockValue}&access_token=${localStorage.getItem(
            "yandex_access_token"
          )}`
        ).catch((error) => console.log(error));
      },
      { once: true }
    );

    const exitUpdateStockListener = (e) => {
      const newValue = cell.querySelector(".change-stock--input-number").value;

      if (e.target !== cell && e.target.nodeName !== "INPUT" && newValue) {
        cell.textContent = newValue;
        document.removeEventListener("click", exitUpdateStockListener);
      }
    };

    document.addEventListener("click", exitUpdateStockListener);
  }
};

fbsCells.addEventListener("click", updateStockListener);
