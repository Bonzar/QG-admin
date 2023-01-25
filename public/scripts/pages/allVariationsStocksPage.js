import { registerTableFilters } from "../functions/registerTableFilters.js";

//todo change three dots icon
registerTableFilters([
  {
    param: "stock_status",
    value: ["outofstock"],
  },
  {
    param: "isActual",
    value: ["notActual", "all"],
  },
]);
