import { registerTableFilters } from "../functions/registerTableFilters.js";

registerTableFilters([
  {
    param: "stock_status",
    value: ["outofstockFBS"],
  },
  {
    param: "isActual",
    value: ["notActual", "all"],
  },
]);
