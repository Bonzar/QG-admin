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
      return `<tr><td>${product.productSku}</td><td>${product.productName}</td>
<!--<td class=".col&#45;&#45;stocks-fbm">${0}</td>-->
       <td class=".col--stocks-fbs">${product.productStock}</td></tr>`;
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
