export function getOzonClientId(isNewId = false) {
  let clientId = localStorage.getItem("ozonClientId");
  if (!clientId || isNewId) {
    clientId = prompt("Enter client id: ");
    localStorage.setItem("ozonClientId", clientId);
  }

  return clientId;
}

export function getOzonApiKey(isNewKey = false) {
  let apiKey = localStorage.getItem("ozonApiKey");
  if (!apiKey || isNewKey) {
    apiKey = prompt("Enter API key: ");
    localStorage.setItem("ozonApiKey", apiKey);
  }

  return apiKey;
}
