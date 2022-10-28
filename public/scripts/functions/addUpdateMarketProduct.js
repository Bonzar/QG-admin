import { formatAddUpdateMarketProductResult } from "./formatAddUpdateMarketProductResult.js";
import { addLoading } from "./addLoadingIcon.js";
import formatResponseBody from "./formatResponseBody.js";
import authCheck from "./getAuthToken.js";

export default (e) => {
  if (!e.target.classList.contains("submit-button")) return;
  e.stopPropagation();

  const authToken = authCheck();

  const form = e.target.parentElement;

  if (!form.reportValidity()) {
    return;
  }

  const FD = new FormData(form);
  if (!FD.has("product_id")) {
    FD.set(
      "product_id",
      document.querySelector("input[name=product_id][hidden]").value
    );
  }
  if (!FD.has("variation_volume")) {
    FD.set(
      "variation_volume",
      e.currentTarget.querySelector("input[name=variation_volume][hidden]")
        .value
    );
  }

  let updateProps = {};
  FD.forEach((value, key) => {
    updateProps[key] = value;
  });

  if (!updateProps.marketType)
    return alert("Неверный параметр названия маркетплейса.");

  const productUpdateId = form.querySelector('input[name="_id"]');
  // Set request url for Update or Add Market product dependence on existing _id prop
  let requestUrl = `/stocks/${updateProps.marketType.toLowerCase()}/${
    productUpdateId ? productUpdateId.value : "new"
  }`;

  const removeLoading = addLoading(form);

  fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(updateProps),
  })
    .then(formatResponseBody)
    .then(async (result) => {
      if (result.response.ok) {
        const textBody = JSON.parse(await result.textBody);
        const resultFormat = formatAddUpdateMarketProductResult(
          textBody.results,
          textBody.marketType
        );

        if (!resultFormat.status) {
          alert(resultFormat.message);
        }

        // window.location.href = "";
      } else {
        alert(JSON.parse(await result.textBody).message);
      }
    })
    .catch((error) => console.log(error))
    .finally(removeLoading);
};
