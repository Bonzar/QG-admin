export function getOzonClientId(isNewId = false) {
    let clientId = localStorage.getItem('clientId');
    if (!clientId || isNewId) {
        clientId = prompt('Enter client id: ');
        localStorage.setItem('clientId', clientId);
    }

    return clientId;
}

export function getOzonApiKey(isNewKey = false) {
    let apiKey = localStorage.getItem('ApiKey');
    if (!apiKey || isNewKey) {
        apiKey = prompt('Enter API key: ');
        localStorage.setItem('ApiKey', apiKey);
    }

    return apiKey;
}
