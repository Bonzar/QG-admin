const form = document.querySelector(".market-product--form");
const submitButton = form.querySelector(".market-product--submit-button");

submitButton.addEventListener("click", function () {
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
  const updateProps = {};
  FD.forEach((value, key) => {
    updateProps[key] = value;
  });
  if (updateProps.marketType) {
    let request;

    const productUpdateId = document.querySelector('input[name="_id"]').value;
    // Если есть поле с id товара, значит его нужно обновить
    if (productUpdateId) {
      request = fetch(
        `/stocks/${updateProps.marketType.toLowerCase()}/${productUpdateId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(updateProps),
        }
      );
      // ID товара нет -> создаем новый товар
    } else {
      request = fetch(`/stocks/${updateProps.marketType.toLowerCase()}/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateProps),
      });
    }

    request
      .then((response) => {
        if (response.ok) {
          window.location.href = "";
          return;
        }
        return response;
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

        alert(result);
        window.location.href = "";
      })
      .catch((error) => console.log(error));
  } else {
    alert("Неверный параметр названия маркетплейса.");
  }
});
