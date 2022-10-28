const table = document.querySelector(".stocks-table");

table.addEventListener("click", (e) => {
  const cell = e.target;

  // redirect to variation page
  if (
    cell.classList.value.includes("col--id") &&
    cell.nodeName === "TD" &&
    cell.id
  ) {
    window.location.href = `/stocks/db/wooVariable/${cell.id}`;
  }
});
