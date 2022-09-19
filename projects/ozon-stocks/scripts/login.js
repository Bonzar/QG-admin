export function getClientId(isNewId = false) {
    let clientId = localStorage.getItem('clientId');
    if (!clientId || isNewId) {
        clientId = prompt('Enter client id: ');
        localStorage.setItem('clientId', clientId);
    }

    return clientId;
}

export function getApiKey(isNewKey = false) {
    let ApiKey = localStorage.getItem('ApiKey');
    if (!ApiKey || isNewKey) {
        ApiKey = prompt('Enter API key: ');
        localStorage.setItem('ApiKey', ApiKey);
    }

    return ApiKey;
}
