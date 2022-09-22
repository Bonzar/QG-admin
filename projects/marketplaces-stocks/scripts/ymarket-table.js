// import {getOzonApiKey, getOzonClientId} from './login.js';

function fillYandexTable(products) {
  // const storageTableBody = document.querySelector('#ozon-stocks-table');
  //
  // const tableRowsHtml = products['result']['items'].map(product => {
  //     return `<tr><td>${product['product_id']}</td><td>${product['offer_id']}</td><td>${product.stocks[0]?.present ?? 0}</td><td>${product.stocks[1]?.present ?? 0}</td></tr>`
  // }).join('')
  //
  // storageTableBody.insertAdjacentHTML('beforeend', tableRowsHtml);
}

function getYandexData() {
  return fetch(
    `https://api.partner.market.yandex.ru/v2/campaigns/21938028/stats/skus.json`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth oauth_token="y0_AgAAAAAS1CmNAAhtsAAAAADPYoE0sFOwF-gGQq2gjR8AqiIGxQBAR04", oauth_client_id="111ace45a0254fec8d4550d496bb10b3"`,
      },
      body: JSON.stringify({ shopSkus: ["31Сириус"] }),
    }
  ).then((response) => response.json());
}

getYandexData().then((data) => fillYandexTable(data));

// const resetLoginBtn = document.querySelector('#resetOzonLogin');
// resetLoginBtn.addEventListener('click', () => {
//     // getOzonClientId(true);
//     // getOzonApiKey(true);
//     getYandexData().then(data => fillYandexTable(data));
// });
