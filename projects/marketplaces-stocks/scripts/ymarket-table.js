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
    return fetch(`https://api.partner.market.yandex.ru/v2/campaigns/959756/stats/skus.json`,
        {
            method: "POST",
            credentials: "include",
            "headers": {
                "Content-Type": 'application/json',
                "Authorization": `OAuth oauth_token="y0_AgAAAAAS1CmNAAhtbgAAAADPWuzJP_uxJO4iSWip64zrL2CsvsvQ28s", oauth_client_id="b341ad7632764f4daa12c56372b347e0"`
            },
            // body: JSON.stringify({
            //     "filter": {},
            //     "last_id": "",
            //     "limit": 200
            // })
        })
        .then(response => response.json());
}


getYandexData().then(data => fillYandexTable(data));

// const resetLoginBtn = document.querySelector('#resetOzonLogin');
// resetLoginBtn.addEventListener('click', () => {
//     // getOzonClientId(true);
//     // getOzonApiKey(true);
//     getYandexData().then(data => fillYandexTable(data));
// });

