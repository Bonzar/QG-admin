import { registerTableFilters } from "../functions/registerTableFilters.js";

registerTableFilters([
  {
    param: "stock_status",
    value: ["outofstock", "outofstockFBS", "instockFBS"],
  },
  {
    param: "isActual",
    value: ["notActual", "all"],
  },
]);
