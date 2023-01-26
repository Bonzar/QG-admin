import { addLoading } from "../functions/addLoadingIcon.js";
import { FetchWrapper } from "../functions/fetchWrapper.js";
import { registerTableFilters } from "../functions/registerTableFilters.js";

const API = new FetchWrapper("/stocks/db/variation/");

const tableCells = document.querySelectorAll(".stocks-tables--cell");
const header = document.querySelector(".header--body");

const getMobileInputFocusListener = (tableInner, tableCell) => {
  return async (event) => {
    event.stopPropagation();
    const form = event.currentTarget.closest(".update-variation-stock--form");

    header.classList.add("disabled");

    tableCell.classList.replace(
      "snap-scroll-stop--center",
      "snap-scroll-stop--start"
    );

    tableCell.classList.add("update-variation-stock--mobile-small-table");

    for (const tableCellToDisableSnap of tableCells) {
      if (tableCellToDisableSnap !== tableCell)
        tableCellToDisableSnap.classList.remove("snap-scroll-stop--center");
    }

    form.closest("tr").classList.add("snap-scroll-stop--center");
  };
};

const getMobileInputBlurListener = (tableInner, tableCell) => {
  return (event) => {
    event.stopPropagation();
    const form = event.currentTarget.closest(".update-variation-stock--form");
    form.closest("tr").classList.remove("snap-scroll-stop--center");

    tableCell.classList.remove("update-variation-stock--mobile-small-table");

    tableCell.classList.replace(
      "snap-scroll-stop--start",
      "snap-scroll-stop--center"
    );

    for (const tableCell of tableCells) {
      tableCell.classList.add("snap-scroll-stop--center");
    }

    header.classList.remove("disabled");
  };
};

tableCells.forEach((tableCell) => {
  const tableInner = tableCell.querySelector(".stocks-table--inner");
  const table = tableCell.querySelector(".stocks-table");

  const mobileInputFocusListener = getMobileInputFocusListener(
    tableInner,
    tableCell
  );
  const mobileInputBlurListener = getMobileInputBlurListener(
    tableInner,
    tableCell
  );

  table.addEventListener("click", (event) => {
    if (
      event.target.nodeName === "INPUT" &&
      event.target.getAttribute("type") === "submit"
    ) {
      event.preventDefault();

      const form = event.target.parentElement;
      if (!form.reportValidity()) {
        return;
      }

      const FD = new FormData(form);
      let updateProps = {};
      FD.forEach((value, key) => {
        updateProps[key] = value;
      });

      //todo add disable for three dots btn for update time
      const removeLoading = addLoading(form);
      API.post("updateStock/", updateProps)
        .then(() => form.classList.add("disabled"))
        .catch((error) => console.error(error))
        .finally(removeLoading);
    }

    if (event.target.classList.contains("update-variation-stock--btn")) {
      const form = event.target
        .closest("tr")
        .querySelector(".update-variation-stock--form");

      form.classList.toggle("disabled");

      const inputs = form.querySelectorAll('input[type="tel"]');

      if (!form.classList.contains("disabled")) {
        // code below only for mobile
        if (window.matchMedia("(pointer:coarse)").matches) {
          inputs.forEach((input) => {
            input.addEventListener("focus", mobileInputFocusListener);
            input.addEventListener("blur", mobileInputBlurListener);
          });
        }

        inputs[0]?.focus();
      } else {
        if (window.matchMedia("(pointer:coarse)").matches) {
          inputs.forEach((input) => {
            input.removeEventListener("focus", mobileInputFocusListener);
            input.removeEventListener("blur", mobileInputBlurListener);
          });
        }
      }
    }
  });
});

const redistributeVariationsStockBtn = document.querySelector(
  ".redistribute-variations-stock--btn"
);
redistributeVariationsStockBtn.addEventListener("click", (event) => {
  const removeLoading = addLoading(event.currentTarget);
  API.post("redistributeStock")
    .then((result) => console.log(result))
    .catch((error) => console.error(error))
    .finally(removeLoading);
});

registerTableFilters([
  {
    param: "stock-update-status",
    value: ["not-updated"],
  },
]);
