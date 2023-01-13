import { addLoading } from "../functions/addLoadingIcon.js";

const getWbShipmentButton = document.querySelector("#get-wb-shipment-button");
getWbShipmentButton.addEventListener("click", (event) => {
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

      const removeLoading = addLoading(event.currentTarget);
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
          document.head.appendChild(a);
          a.href = window.URL.createObjectURL(data);
          a.download = "wbShipment";
          a.click();
          document.head.removeChild(a);
        })
        .catch((error) => console.error(error))
        .finally(() => removeLoading());
    }
  } catch (e) {
    console.log(e);
    alert(e.message);
  }
});

const getOzonShipmentButton = document.querySelector(
  "#get-ozon-shipment-button"
);
getOzonShipmentButton.addEventListener("click", (event) => {
  const dateShiftDays = Number.parseInt(
    prompt("Введите кол-во дней для сдвига (на сборку/приемку): ", "14"),
    10
  );
  const predictPeriodDays = Number.parseInt(
    prompt("Введите на сколько дней рассчитывать поставку: ", "30"),
    10
  );

  if (!Number.isInteger(dateShiftDays) || !Number.isInteger(dateShiftDays)) {
    alert(
      "Ошибка, неверный формат параметров. Укажите в параметрах только целые числа."
    );
    return;
  }

  const removeLoading = addLoading(event.currentTarget);
  fetch(`/shipments/ozon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dateShiftDays, predictPeriodDays }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = await response.json();
        throw new Error(`Ошибка получения поставки. – ${data.message}`);
      }
      return response.blob();
    })
    .then((data) => {
      const a = document.createElement("a");
      document.head.appendChild(a);
      a.href = window.URL.createObjectURL(data);
      a.download = "ozonShipment";
      a.click();
      document.head.removeChild(a);
    })
    .catch((error) => console.error(error))
    .finally(() => removeLoading());
});
