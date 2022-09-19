import {getApiKey, getClientId} from './login.js';

function fillTable(products) {
    const storageTableBody = document.querySelector('#storage-table');

    const tableRowsHtml = products['result']['items'].map(product => {
        return `<tr><td>${product['product_id']}</td><td>${product['offer_id']}</td><td>${product.stocks[0]?.present ?? 0}</td><td>${product.stocks[1]?.present ?? 0}</td></tr>`
    }).join('')

    storageTableBody.insertAdjacentHTML('beforeend', tableRowsHtml);
}

function getOzonData() {
    return fetch(`https://api-seller.ozon.ru/v3/product/info/stocks`,
        {
            method: "POST",
            "headers": {
                "Client-Id": getClientId(),
                "Api-Key": getApiKey(),
                "Content-Type": 'application/json',
            },
            body: JSON.stringify({
                "filter": {},
                "last_id": "",
                "limit": 200
            })
        })
        .then(response => response.json());
}


getOzonData().then(data => fillTable(data));

const resetLoginBtn = document.querySelector('#resetOzonData');
resetLoginBtn.addEventListener('click', () => {
    getClientId(true);
    getApiKey(true);
    getOzonData().then(data => fillTable(data));
});