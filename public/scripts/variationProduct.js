const updateMarketplaceProduct = (e) => {
  const form = e.target.parentElement;

  if (!form.reportValidity()) {
    return;
  }

  const authToken = localStorage.getItem("authToken");
  const authTokenExpires = localStorage.getItem("authTokenExpires");
  if (!(Date.now() < authTokenExpires && authToken)) {
    alert(
      "Токен доступа не указан или его срок жизни истек. Необходима повторная авторизация."
    );
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("authTokenExpires");
    return (window.location.href = "/auth/login");
  }

  const FD = new FormData(form);

  FD.set(
    "product_id",
    document.querySelector("input[name=product_id][hidden]").value
  );
  FD.set(
    "variation_volume",
    document.querySelector("input[name=variation_volume][hidden]").value
  );

  const updateProps = {};
  FD.forEach((value, key) => {
    updateProps[key] = value;
  });

  if (!updateProps.marketType)
    return alert("Неверный параметр названия маркетплейса.");

  const productUpdateId = form.querySelector('input[name="_id"]').value;
  if (!productUpdateId)
    return alert("Не верно указан id продукта маркетплейса.");

  fetch(`/stocks/${updateProps.marketType.toLowerCase()}/${productUpdateId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(updateProps),
  })
    // response body to text
    .then((response) => {
      if (!response) return;
      const reader = response.body.getReader();

      const stream = new ReadableStream({
        start(controller) {
          // The following function handles each data chunk
          function push() {
            // "done" is a Boolean and value a "Uint8Array"
            reader.read().then(({ done, value }) => {
              // If there is no more data to read
              if (done) {
                controller.close();
                return;
              }
              // Get the data and send it to the browser via the controller
              controller.enqueue(value);
              // Check chunks by logging to the console
              push();
            });
          }

          push();
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/html" },
      }).text();
    })
    .then((result) => {
      if (!result) return;

      result = JSON.parse(result);

      let isMarketProductUpdated = !!result.results.marketProductUpdate;
      let isVariationUpdated = !!result.results.variationUpdate;
      let isFbsStockUpdated = false;
      let fbsStockUpdateError = null;

      let fbsStockUpdate = result.results.fbsStockUpdate;
      switch (result.marketType) {
        case "wb":
          isFbsStockUpdated = !fbsStockUpdate.error;
          if (!isFbsStockUpdated) {
            fbsStockUpdateError = fbsStockUpdate.errorText;
          }
          break;
        case "ozon":
          isFbsStockUpdated = fbsStockUpdate.result[0].updated;
          if (!isFbsStockUpdated) {
            fbsStockUpdateError = fbsStockUpdate.result[0].errors
              .map((error) => error.message)
              .join(". ");
          }
          break;
        case "yandex":
          isFbsStockUpdated = fbsStockUpdate.status === "OK";
          if (!isFbsStockUpdated) {
            fbsStockUpdateError = "Ошибка обновления остатков";
          }
          break;
      }

      const resultMessage = `Продукт маркетплейса: ${
        isMarketProductUpdated ? "Обновлен" : "Не обновлен"
      }\nВариация: ${
        isVariationUpdated ? "Обновлена" : "Не обновлена"
      }\nОстаток FBS: ${
        isFbsStockUpdated ? "Обновлен" : "Не обновлен: " + fbsStockUpdateError
      }`;

      alert(resultMessage);
      window.location.href = "";
    })
    .catch((error) => console.log(error));
};

const submitButtons = document.querySelectorAll(".submit-button");

for (const submitButton of submitButtons) {
  submitButton.addEventListener("click", updateMarketplaceProduct);
}
