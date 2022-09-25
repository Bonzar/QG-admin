// import {getOzonApiKey, getOzonClientId} from './login.js';

/**
 * @param {object} products
 * @param {string} products.productSku
 * @param {string} products.productName
 * @param {number} products.productStock
 */
function fillYandexTable(products) {
  const storageTableBody = document.querySelector("#yandex-stocks-table");

  const tableRowsHtml = products
    .map((product) => {
      return `<tr><td>${product.productSku}</td><td>${
        product.productName
      }</td><td>${0}</td><td>${product.productStock}</td></tr>`;
    })
    .join("");

  storageTableBody.insertAdjacentHTML("beforeend", tableRowsHtml);
}

function getYandexData() {
  return fetch(`/yandex-stocks`).then((response) => response.json());
}

getYandexData().then((data) => fillYandexTable(data));
