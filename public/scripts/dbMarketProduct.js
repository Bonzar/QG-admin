import addUpdateMarketProduct from "./addUpdateMarketProduct.js";

document.addEventListener("click", addUpdateMarketProduct);

const parentVariableSelect = document.querySelector(
  "select[name='parentVariable']"
);
const productTypeSelect = document.querySelector("select[name='type']");
productTypeSelect.addEventListener("change", (e) => {
  const productType = e.currentTarget;
  if (productType.value === "variation") {
    parentVariableSelect.removeAttribute("disabled");
  } else {
    parentVariableSelect.setAttribute("disabled", "disabled");
  }
});
