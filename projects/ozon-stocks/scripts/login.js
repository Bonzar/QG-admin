export function getClientId(isNewId = false) {
    let clientId = localStorage.getItem('clientId');
    if (!clientId || isNewId) {
        clientId = prompt('Enter client id: ');
        localStorage.setItem('clientId', clientId);
    }

    return clientId;
}

export function getApiKey(isNewKey = false) {
    let apiKey = localStorage.getItem('ApiKey');
    if (!apiKey || isNewKey) {
        apiKey = prompt('Enter API key: ');
        localStorage.setItem('ApiKey', apiKey);
    }

    return apiKey;
}
