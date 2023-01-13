import addUpdateMarketProduct from "../functions/addUpdateMarketProduct.js";
import authCheck from "../functions/getAuthToken.js";
import { addLoading } from "../functions/addLoadingIcon.js";

document.addEventListener("click", addUpdateMarketProduct);

const parentVariableSelect = document.querySelector(
  "select[name='parentVariable']"
);
const productTypeSelect = document.querySelector("select[name='type']");
productTypeSelect?.addEventListener("change", (e) => {
  const productType = e.currentTarget;
  if (productType.value === "variation") {
    parentVariableSelect.removeAttribute("disabled");
  } else {
    parentVariableSelect.setAttribute("disabled", "disabled");
  }
});

const deleteMarketProduct = (e) => {
  const form = e.target.parentElement;

  const authToken = authCheck();

  const marketProductId = form.querySelector('input[name="_id"]');
  if (!marketProductId) return alert("Не верно указан id для удаления.");

  const marketType = form.querySelector('input[name="marketType"]');
  if (!marketType) return alert("Не верно указан тип маркетплейса.");

  if (confirm(`Удалить продукт?`)) {
    const removeLoading = addLoading(form);
    fetch(`/stocks/${marketType.value}/${marketProductId.value}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = `/stocks/${marketType.value}`;
        } else {
          alert("Продукт маркетплейса не удален.");
        }
      })
      .catch((error) => console.error(error))
      .finally(removeLoading);
  }
};

const marketProductDeleteButton = document.querySelector(
  ".delete-button--market-product"
);

marketProductDeleteButton?.addEventListener("click", deleteMarketProduct);
