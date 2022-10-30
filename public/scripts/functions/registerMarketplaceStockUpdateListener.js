import authCheck from "./getAuthToken.js";
import yandexStockUpdate from "./yandexStockUpdate.js";
import wbStockUpdate from "./wbStockUpdate.js";
import ozonStockUpdate from "./ozonStockUpdate.js";
import wooStockUpdate from "./wooStockUpdate.js";

const updateStockListener = function (e) {
  const cell = e.target;

  const refLink = cell.getAttribute("ref");
  const updateIdentify = cell.getAttribute("updateBy");

  // redirect to Product page
  if (
    cell.classList.value.includes("col--name") &&
    cell.nodeName === "TD" &&
    refLink
  ) {
    window.location.href = `/stocks/db/product/${refLink}`;
    // redirect to market product page
  } else if (
    cell === cell.parentElement.firstElementChild &&
    cell.nodeName === "TD" &&
    refLink
  ) {
    window.location.href = `/stocks/${e.currentTarget.id}/${refLink}`;
  }

  // stock change form on stock click
  if (
    cell.classList.value.includes("col--fbs") &&
    cell.nodeName === "TD" &&
    !cell.querySelector(".change-stock--form") &&
    updateIdentify
  ) {
    const oldValue = cell.textContent;
    cell.classList.add("col--fbs--changing");
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

        document.removeEventListener("click", exitUpdateStockListener);

        const authToken = authCheck();

        let fetchUpdateFunction;
        switch (cell.getAttribute("marketType")) {
          case "yandex":
            fetchUpdateFunction = yandexStockUpdate;
            break;
          case "wb":
            fetchUpdateFunction = wbStockUpdate;
            break;
          case "ozon":
            fetchUpdateFunction = ozonStockUpdate;
            break;
          case "woo":
            fetchUpdateFunction = wooStockUpdate;
            break;
        }

        fetchUpdateFunction(
          cell,
          updateIdentify,
          newStockValue,
          oldValue,
          authToken
        )
          .then((response) => {
            if (response.status === 403) {
              alert("Вы не авторизованы!");
            }
          })
          .finally(() => {
            cell.classList.remove("col--fbs--changing");
            if (
              cell.textContent === newStockValue &&
              newStockValue !== oldValue
            ) {
              cell.classList.toggle("out-of-stock");
            }
          });
      },
      { once: true }
    );

    const exitUpdateStockListener = (e) => {
      if (e.target !== cell && e.target.nodeName !== "INPUT") {
        cell.textContent = oldValue;
        cell.classList.remove("col--fbs--changing");
        document.removeEventListener("click", exitUpdateStockListener);
      }
    };

    document.addEventListener("click", exitUpdateStockListener);
  }
};

const stocksTables = document.querySelectorAll(".stocks-table");
stocksTables.forEach((stocksTable) =>
  stocksTable.addEventListener("click", updateStockListener)
);
