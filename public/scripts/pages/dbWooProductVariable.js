import authCheck from "../functions/getAuthToken.js";
import { addLoading } from "../functions/addLoadingIcon.js";

const addUpdateWooProductVariable = (e) => {
  const authToken = authCheck();

  const form = e.target.parentElement;

  if (!form.reportValidity()) {
    return;
  }

  const FD = new FormData(form);

  let updateProps = {};
  FD.forEach((value, key) => {
    updateProps[key] = value;
  });

  const wooProductVariableUpdateId = form.querySelector('input[name="_id"]');
  // Set request url for Update or Add woo Product Variable dependence on existing _id prop
  let requestUrl = `/stocks/db/wooVariable/${
    wooProductVariableUpdateId ? wooProductVariableUpdateId.value : "new"
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
    .then((response) => {
      if (response.ok) {
        window.location.href = `/stocks/db/wooVariables`;
      } else {
        alert("Woo Product Variable не добавлен/обновлен.");
      }
    })
    .catch((error) => console.error(error))
    .finally(removeLoading);
};

const deleteWooProductVariable = (e) => {
  const authToken = authCheck();

  const wooProductVariableId = document.querySelector(
    "input[name='_id'][hidden]"
  );

  if (!wooProductVariableId) return alert("Не верно указан id для удаления.");

  if (confirm(`Удалить woo product variable?`)) {
    const removeLoading = addLoading(e.target.parentElement);
    fetch(`/stocks/db/wooVariable/${wooProductVariableId.value}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = `/stocks/db/wooVariables`;
        } else {
          alert("Woo product variable не удален.");
        }
      })
      .catch((error) => console.error(error))
      .finally(removeLoading);
  }
};

const wooProductVariableDeleteButton = document.querySelector(
  ".delete-button--woo-product-variable"
);
if (wooProductVariableDeleteButton)
  wooProductVariableDeleteButton.addEventListener(
    "click",
    deleteWooProductVariable
  );

const wooProductVariableSubmitButton = document.querySelector(
  ".submit-button--woo-product-variable"
);
if (wooProductVariableSubmitButton)
  wooProductVariableSubmitButton.addEventListener(
    "click",
    addUpdateWooProductVariable
  );
