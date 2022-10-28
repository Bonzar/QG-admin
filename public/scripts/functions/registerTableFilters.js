// Обработка кнопок-фильтров
const urlParams = new URLSearchParams(window.location.search.slice(1));

for (const { param, value } of [
  {
    param: "stock_status",
    value: [
      "outofstock",
      "outofstockall",
      "instockFBS",
      "instockFBM",
      "instockSome",
    ],
  },
  {
    param: "isActual",
    value: ["notActual", "all"],
  },
]) {
  const filterBtns = document.querySelectorAll(`.table-filter-name--${param}`);

  for (let i = 0; i < filterBtns.length; i++) {
    const filterBtn = document.querySelector(
      `.table-filter-value--${value[i]}`
    );

    if (
      urlParams.get(param) === value[i] &&
      !filterBtn.classList.contains("table-filter--btn-active")
    ) {
      const oldValue = urlParams.get(param);
      urlParams.delete(param);
      filterBtn.classList.add("table-filter--btn-active");
      filterBtn["href"] = urlParams.toString()
        ? `?${urlParams.toString()}`
        : window.location.pathname;
      urlParams.set(param, oldValue);
    } else {
      filterBtn.classList.remove("table-filter--btn-active");

      const oldValue = urlParams.get(param);

      urlParams.set(param, value[i]);
      filterBtn["href"] = `?${urlParams.toString()}`;
      urlParams.delete(param);

      if (oldValue) {
        urlParams.set(param, oldValue);
      }
    }
  }
}
