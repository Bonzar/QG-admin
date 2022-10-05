// Обработка кнопок-фильтров
const urlParams = new URLSearchParams(window.location.search.slice(1));

for (const { param, value } of [
  {
    param: "stock_status",
    value: ["outofstock", "outofstockall"],
  },
]) {
  const filterBtns = document.querySelectorAll(`.table-filter-name--${param}`);

  for (let i = 0; i < filterBtns.length; i++) {
    const filterBtn = filterBtns[i];

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
