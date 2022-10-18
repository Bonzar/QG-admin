import authCheck from "./authCheck.js";

export const updateMarketplaceStock = (fetchUpdateFunction, tableHtml) => {
  const updateStockListener = function (e) {
    const cell = e.target;

    // redirect to Product page
    if (
      cell.classList.value.includes("col--name") &&
      cell.nodeName === "TD" &&
      cell.id
    ) {
      window.location.href = `/stocks/db/product/${cell.id.split("-")[1]}`;
    }

    // redirect to market product page
    if (
      cell === cell.parentElement.firstElementChild &&
      cell.nodeName === "TD" &&
      cell.id
    ) {
      window.location.href = `/stocks/${tableHtml.id.split("-")[0]}/${
        cell.id.split("-")[1]
      }`;
    }

    // stock change form on stock click
    if (
      cell.classList.value.includes("col--fbs") &&
      cell.nodeName === "TD" &&
      !cell.querySelector(".change-stock--form")
    ) {
      const oldValue = cell.textContent;

      cell.innerHTML = `<form class="change-stock--form">
          <input class="btn change-stock--submit-button" type="button" value="OK">
          <input class="change-stock--input-number" name="stock" type="number" min="0" required value="${cell.textContent}">
        </form>`;

      const form = cell.querySelector(".change-stock--form");
      const submitButton = form.querySelector(".change-stock--submit-button");

      submitButton.addEventListener(
        "click",
        function () {
          const newStockValue = form.querySelector(
            ".change-stock--input-number"
          ).value;
          const idUpdate = cell.parentElement
            .querySelector("td.col--name")
            .getAttribute("updateBy");

          document.removeEventListener("click", exitUpdateStockListener);

          const authToken = authCheck();

          fetchUpdateFunction(
            cell,
            idUpdate,
            newStockValue,
            oldValue,
            authToken
          ).then((response) => {
            if (response.status === 403) {
              alert("Вы не авторизованы!");
            }
          });
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
