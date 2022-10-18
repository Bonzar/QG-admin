import authCheck from "./authCheck.js";
import { addUpdateMarketProduct } from "./dbMarketProduct.js";

const deleteProduct = (e) => {
  const form = e.target.parentElement;

  const authToken = authCheck();

  const productUpdateId = form.querySelector('input[name="_id"]');
  if (!productUpdateId) return alert("Не верно указан id для удаления.");

  if (confirm(`Удалить продукт?`)) {
    fetch(`/stocks/db/product/${productUpdateId.value}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = "/stocks/db/products";
        } else {
          alert("Продукт не удален.");
        }
      })
      .catch((error) => console.log(error));
  }
};

const addUpdateProduct = (e) => {
  if (!e.target.classList.contains("submit-button")) return;
  e.stopPropagation();

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

  const productUpdateId = form.querySelector('input[name="_id"]');
  // Set request url for Update or Add Product dependence on existing _id prop
  let requestUrl = `/stocks/db/product/${
    productUpdateId ? productUpdateId.value : "new"
  }`;

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
        alert("Готово.");
      } else {
        alert("Продукт не обновлен.");
      }
    })
    .catch((error) => console.log(error));
};

const deleteVariation = (e) => {
  const authToken = authCheck();

  const productId = document.querySelector(
    "input[name=product_id][hidden]"
  ).value;

  const variationIdInput = e.target.parentElement.querySelector(
    'input[name="variation_id"]'
  );
  if (!variationIdInput) return alert("Не верно указан id для удаления.");

  if (confirm(`Удалить Вариацию?`)) {
    fetch(`/stocks/db/variation/${variationIdInput.value}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = `/stocks/db/product/${productId}`;
        } else {
          alert("Вариация не удалена.");
        }
      })
      .catch((error) => console.log(error));
  }
};

const productDeleteButton = document.querySelector(".delete-button--product");
if (productDeleteButton)
  productDeleteButton.addEventListener("click", deleteProduct);

const productVariationDeleteButtons = document.querySelectorAll(
  ".delete-button--variation"
);
for (const productVariationDeleteButton of productVariationDeleteButtons) {
  productVariationDeleteButton.addEventListener("click", deleteVariation);
}

const productSubmitButton = document.querySelector(".submit-button--product");
if (productSubmitButton)
  productSubmitButton.addEventListener("click", addUpdateProduct);

const variationBlocks = document.querySelectorAll(".product-variation--block");
for (const marketProductForm of variationBlocks) {
  marketProductForm.addEventListener("click", addUpdateMarketProduct);
}

const addVariationForm = document.querySelector(".add-variation--form");
addVariationForm.addEventListener("click", (e) => {
  if (!e.target.classList.contains("add-variation--btn")) return;

  const addVariationForm = e.currentTarget;
  const volumeSelect = addVariationForm.querySelector(
    ".add-variation--volume-select"
  );

  if (volumeSelect.hasAttribute("disabled")) {
    volumeSelect.removeAttribute("disabled");
  } else {
    if (!volumeSelect.reportValidity()) {
      return;
    }

    const authToken = authCheck();

    const FD = new FormData(addVariationForm);

    const productId = document.querySelector(
      "input[name=product_id][hidden]"
    ).value;

    FD.set("product_id", productId);

    let updateProps = {};
    FD.forEach((value, key) => {
      updateProps[key] = value;
    });

    fetch(`/stocks/db/variation/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateProps),
    })
      .then((response) => {
        if (response.ok) {
          e.target.innerHTML = "";
          window.location.href = `/stocks/db/product/${productId}`;
        } else {
          alert("Вариация не создана.");
        }
      })
      .catch((error) => console.log(error));
  }
});