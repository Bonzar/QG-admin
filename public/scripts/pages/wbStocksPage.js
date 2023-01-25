import { registerTableFilters } from "../functions/registerTableFilters.js";

registerTableFilters([
  {
    param: "stock_status",
    value: [
      "outofstock",
      "outofstockFBS",
      "outofstockFBM",
      "instockFBS",
      "instockFBM",
      "instockSome",
    ],
  },
  {
    param: "isActual",
    value: ["notActual", "all"],
  },
]);
