import authCheck from "../functions/getAuthToken.js";
import addUpdateMarketProduct from "../functions/addUpdateMarketProduct.js";
import { addLoading } from "../functions/addLoadingIcon.js";

const deleteProduct = (e) => {
  const form = e.target.parentElement;

  const authToken = authCheck();

  const productUpdateId = form.querySelector('input[name="_id"]');
  if (!productUpdateId) return alert("Не верно указан id для удаления.");

  if (confirm(`Удалить продукт?`)) {
    const removeLoading = addLoading(form);
    fetch(`/stocks/db/product/${productUpdateId.value}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          alert(data.message);
        }

        window.location = "../products";
      })
      .catch((error) => console.error(error))
      .finally(removeLoading);
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
      if (!response.ok) {
        alert("Продукт не обновлен.");
      }
    })
    .catch((error) => console.error(error))
    .finally(removeLoading);
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
    const removeLoading = addLoading(e.target.parentElement);
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
      .catch((error) => console.error(error))
      .finally(removeLoading);
  }
};

const styleDisabledMarketProductCard = (e) => {
  const marketProductForm = e.currentTarget;

  const isActualInputs = marketProductForm.querySelectorAll(
    'input[name="isActual"]'
  );

  if (!Array.from(isActualInputs).includes(e.target)) {
    return;
  }

  if (e.target.value === "true") {
    marketProductForm.classList.remove("market-product--form-not-actual");
  } else if (e.target.value === "false") {
    marketProductForm.classList.add("market-product--form-not-actual");
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

const variationBlocks = document.querySelectorAll(".product-variation--cell");
for (const variationBlock of variationBlocks) {
  variationBlock.addEventListener("click", addUpdateMarketProduct);

  const variationStockStatus = variationBlock.querySelector(
    ".variation-stock-status"
  );
  variationStockStatus.addEventListener("click", (event) => {
    const requestOptions = {};
    let actionAccept = false;

    switch (event.currentTarget.dataset.variationStockStatus) {
      case "updated":
        actionAccept = confirm(
          "Остатки вариации успешно обновлены.\nХотите перераспределить остатки?"
        );
        break;
      case "update-failed-reverted":
        actionAccept = confirm(
          "При обновлении остатков вариации произошла ошибка, все остатки возвращены в предыдущее состояние.\nХотите попробовать обновить остатки снова?"
        );
        requestOptions.isProcessFailed = true;
        break;
      case "update-failed-revert-failed":
        actionAccept = confirm(
          "При обновлении остатков вариации произошла ошибка, востановление не удалось.\nХотите попробовать обновить остатки снова?"
        );
        requestOptions.isProcessFailed = true;
        break;
    }
    if (actionAccept) {
      const authToken = authCheck();

      const variationId = variationBlock.querySelector(
        "input[name='variation_id']"
      )?.value;

      const removeLoading = addLoading(variationStockStatus);
      fetch(`/stocks/db/variation/${variationId}/redistribute-stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestOptions),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log(data);
        })
        .catch((error) => console.error(error))
        .finally(() => {
          removeLoading();
          window.location = "";
        });
    }
  });
}

const marketProductForms = document.querySelectorAll(".market-product--form");
for (const marketProductForm of marketProductForms) {
  marketProductForm.addEventListener("change", styleDisabledMarketProductCard);
  const isActualInputs = marketProductForm.querySelectorAll(
    'input[name="isActual"]'
  );
  if (
    Array.from(isActualInputs).find(
      (input) => input.value === "false" && input.hasAttribute("checked")
    )
  ) {
    marketProductForm.classList.add("market-product--form-not-actual");
    marketProductForm.classList.add("order-last");
  }
}

const addVariationForm = document.querySelector(".add-variation--form");
addVariationForm.addEventListener("click", (e) => {
  if (!e.target.classList.contains("add-variation--btn")) return;

  const addVariationForm = e.currentTarget;
  const volumeSelect = addVariationForm.querySelector("select");
  const volumeLabel = addVariationForm.querySelector(
    ".add-variation-volume--block"
  );

  if (volumeLabel.classList.contains("disabled")) {
    volumeLabel.classList.remove("disabled");
  } else if (!volumeSelect.value) {
    volumeLabel.classList.add("disabled");
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
    const removeLoading = addLoading(e.currentTarget.parentElement);
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
      .catch((error) => console.error(error))
      .finally(removeLoading);
  }
});
