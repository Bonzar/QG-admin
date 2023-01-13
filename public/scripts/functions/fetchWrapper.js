import getAuthToken from "./getAuthToken.js";

export class FetchWrapper {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  get(endpoint) {
    return fetch(this.baseURL + endpoint).then((response) => response.json());
  }

  put(endpoint, body) {
    return this.#send("put", endpoint, body);
  }

  post(endpoint, body) {
    return this.#send("post", endpoint, body);
  }

  delete(endpoint, body) {
    return this.#send("delete", endpoint, body);
  }

  #send(method, endpoint, body) {
    return fetch(this.baseURL + endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    })
      .then((response) => {
        if (response?.status === 403) {
          alert("Вы не авторизованы!");
        }
        return response;
      })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error(data.message);
          alert(data.message);
        }
      });
  }
}
