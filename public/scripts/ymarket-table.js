/**
 * @param {[{}]} products
 * @param {string} products.productSku
 * @param {string} products.productName
 * @param {number} products.productStock
 */
// function fillYandexTable(products) {
//   const storageTableBody = document.querySelector("#yandex-stocks-table");
//
//   const tableRowsHtml = products
//     .sort((product1, product2) =>
//       product1.productName > product2.productName ? 1 : -1
//     )
//     .map((product) => {
//       return `<tr><td>${product.productSku}</td><td>${product.productName}</td><td class="col--fbs">${product.productStock}</td></tr>`;
//     })
//     .join("");
//
//   storageTableBody.insertAdjacentHTML("beforeend", tableRowsHtml);
// }
//
// function getYandexData() {
//   let access_token = localStorage.getItem("yandex_access_token");
//   if (!access_token) {
//     const urlParams = new URLSearchParams(window.location.hash.slice(1));
//     access_token = urlParams.get("access_token");
//     if (access_token) {
//       localStorage.setItem("yandex_access_token", access_token);
//     }
//   }
//
//   return fetch(`/projects/yandex?access_token=${access_token ?? ""}`).then(
//     (response) => response.json()
//   );
// }
//
// getYandexData().then((data) => {
//   if (!data.isAuthorize) {
//     const mainHtml = document.querySelector("main");
//     mainHtml.innerHTML = `<a id="YandexLogin" href="https://oauth.yandex.ru/authorize?response_type=token&client_id=${data.clientId}"></a>`;
//     return;
//   }
//   fillYandexTable(data.products);
// });

// Script start
const fbsCells = document.querySelector("#yandex-stocks");

const updateStockListener = function (e) {
  // e.stopPropagation();
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
