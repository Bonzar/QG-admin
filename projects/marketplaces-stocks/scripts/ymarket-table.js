/**
 * @param {[{}]} products
 * @param {string} products.productSku
 * @param {string} products.productName
 * @param {number} products.productStock
 */
function fillYandexTable(products) {
  const storageTableBody = document.querySelector("#yandex-stocks-table");

  const tableRowsHtml = products
    .sort((product1, product2) =>
      product1.productName > product2.productName ? 1 : -1
    )
    .map((product) => {
      return `<tr><td>${product.productSku}</td><td>${product.productName}</td><td class="col--stocks-fbs">${product.productStock}</td></tr>`;
    })
    .join("");

  storageTableBody.insertAdjacentHTML("beforeend", tableRowsHtml);
}

function getYandexData() {
  let access_token = localStorage.getItem("yandex_access_token");
  if (!access_token) {
    const urlParams = new URLSearchParams(window.location.hash.slice(1));
    access_token = urlParams.get("access_token");
    if (access_token) {
      localStorage.setItem("yandex_access_token", access_token);
    }
  }

  return fetch(`/api/yandex?access_token=${access_token ?? ""}`).then(
    (response) => response.json()
  );
}

getYandexData().then((data) => {
  if (!data.isAuthorize) {
    const mainHtml = document.querySelector("main");
    mainHtml.innerHTML = `<a id="YandexLogin" href="https://oauth.yandex.ru/authorize?response_type=token&client_id=${data.clientId}"></a>`;
    return;
  }
  fillYandexTable(data.products);
});

// Script start
const fbsCells = document.querySelector("#yandex-stocks-table");

const updateStockListener = function (e) {
  e.stopPropagation();
  const cell = e.target;
  if (
    cell.classList.value.includes("col--stocks-fbs") &&
    cell.nodeName === "TD"
  ) {
    cell.innerHTML = `<form class="change-stock--form">
          <input class="change-stock--submit-button" type="submit" value="OK">
          <input class="change-stock--input-number" name="stock" type="number" min="0" value="${cell.textContent}">
        </form>`;

    const form = cell.querySelector(".change-stock--form");
    form.addEventListener(
      "submit",
      function (e) {
        e.stopPropagation();

        const newStockValue = e.target.querySelector(
          ".change-stock--input-number"
        ).value;

        const skuUpdate =
          cell.parentElement.querySelector("td:first-of-type").textContent;

        cell.innerHTML = newStockValue;
        form.removeEventListener("submit", this);
        fbsCells.removeEventListener("click", exitUpdateStockListener);

        fetch(
          `/api/yandex/update_stock?access_token=${localStorage.getItem(
            "yandex_access_token"
          )}&sku=${skuUpdate}&stock=${newStockValue}`
        ).catch((error) => console.log(error));
      },
      { once: true }
    );

    const exitUpdateStockListener = (e) => {
      if (e.target.nodeName !== "INPUT") {
        cell.textContent = cell.querySelector(
          ".change-stock--input-number"
        ).value;
        fbsCells.removeEventListener("click", exitUpdateStockListener);
      }
    };

    fbsCells.addEventListener("click", exitUpdateStockListener);
  }
};

fbsCells.addEventListener("click", updateStockListener);
