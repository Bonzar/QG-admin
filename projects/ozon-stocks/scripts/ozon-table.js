import {getApiKey, getClientId} from './config.js';

function fillTable(products) {
    const storageTableBody = document.querySelector('#storage-table');

    const tableRows = products.map(product => {

        return `<tr><td>${product['product_id']}</td><td>${product['offer_id']}</td><td>${product.stocks[0]?.present ?? 0}</td><td>${product.stocks[1]?.present ?? 0}</td></tr>`
    }).join('')

    storageTableBody.insertAdjacentHTML('beforeend', tableRows);
}

fetch(`https://api-seller.ozon.ru/v3/product/info/stocks`,
    {
        method: "POST",
        // mode: "no-cors",
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
    .then(response => response.json())
    .then(data => {
        fillTable(data.result.items)
    }
)





