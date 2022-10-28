const getWbShipmentButton = document.querySelector("#get-wb-shipment-button");
getWbShipmentButton.addEventListener("click", () => {
  try {
    alert(
      "1. Скачайте отчет бренда с маяка за год (с FBS)\n2. Оставьте в нем только столбцы с sku, sales, lost_sales\n3. Сохраните файл в формате CSV\n4. Скопируйте текстовое содержимое файла и вставьте во всплывающее окно"
    );

    let mayakData = prompt("Введите данные с маяка: ");
    if (mayakData) {
      mayakData = mayakData.split("\r\n").map((str) => {
        let [sku, yearSells, lostSells] = str.split(";");

        return {
          sku: +sku,
          sells: Math.round(
            Number(yearSells) + parseFloat(lostSells.replace(",", "."))
          ),
        };
      });

      fetch(`/shipments/wb`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mayakData),
      })
        .then((res) => {
          return res.blob();
        })
        .then((data) => {
          const a = document.createElement("a");
          a.href = window.URL.createObjectURL(data);
          a.download = "wbShipment";
          a.click();
          document.removeChild(a);
        })
        .catch((error) => console.log(error));
    }
  } catch (e) {
    console.log(e);
    alert(e.message);
  }
});
