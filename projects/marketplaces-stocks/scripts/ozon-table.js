import { getOzonApiKey, getOzonClientId } from "./login.js";

function fillTable(products) {
  const storageTableBody = document.querySelector("#ozon-stocks-table");

  const tableRowsHtml = products["result"]["items"]
    .map((product) => {
      return `<tr><td>${product["product_id"]}</td><td>${
        product["offer_id"]
      }</td><td>${product.stocks[0]?.present ?? 0}</td><td>${
        product.stocks[1]?.present ?? 0
      }</td></tr>`;
    })
    .join("");

  storageTableBody.insertAdjacentHTML("beforeend", tableRowsHtml);
}

function getOzonData() {
  return fetch(`/api/ozon`).then((response) => response.json());
}

getOzonData().then((data) => fillTable(data));

const resetLoginBtn = document.querySelector("#resetOzonLogin");
resetLoginBtn.addEventListener("click", () => {
  getOzonClientId(true);
  getOzonApiKey(true);
  getOzonData().then((data) => fillTable(data));
});
