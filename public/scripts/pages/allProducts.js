const table = document.querySelector(".stocks-table");

table.addEventListener("click", (e) => {
  const cell = e.target;

  // redirect to variation page
  if (
    cell.classList.value.includes("col--name") &&
    cell.nodeName === "TD" &&
    cell.getAttribute("ref")
  ) {
    window.location.href = `/stocks/db/product/${cell.getAttribute("ref")}`;
  }
});
