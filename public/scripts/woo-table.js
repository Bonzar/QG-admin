// Отображение окна обновления остатков при нажатии на статус товара
const fbsCells = document.querySelector("#site-stocks");
const updateStockListener = async function (e) {
  const cell = e.target;
  if (
    cell.classList.value.includes("col--fbs") &&
    cell.nodeName === "TD" &&
    !cell.querySelector(".change-stock--form")
  ) {
    const idSelected = cell.parentElement.querySelector(".col--id").textContent;

    const oldValue = cell.textContent;

    const productData = await fetch(`/stocks/woo/${idSelected}/info`)
      .then(async (response) => {
        return response.json();
      })
      .catch((error) => console.log(error));

    const fieldsHtml = productData.products
      .map((product) => {
        const productAttributesName = product.attributes
          .map((attribute) => attribute.option)
          .join(" ");

        return `<fieldset> 
        <!-- Установка названия аттрибута, если тип продукта variable -->
        <legend>${productAttributesName}</legend>    
        ${productAttributesName ? "<hr>" : ""}    
        <!-- Управление запасами -->
        <label>
          <input class="change-stock--manage-stock" name="manage_stock-${
            product.id
          }" type="checkbox" ${
          product.manage_stock ? "checked" : ""
        }> Точное кол-во
          <!-- Если управление запасами включено: Количество в наличии -->
          <input class="change-stock--input-number" name="stock_quantity-${
            product.id
          }" type="number" min="0" value="${product.stock_quantity ?? 0}" ${
          product.manage_stock ? "" : "disabled"
        }
          >
        </label>
        <!-- Если управление запасами выключено: Установка В наличии/Нет в наличии -->
        <label><input class="change-stock--instock" required="required" ${
          product.manage_stock ? "disabled" : ""
        } name="stock_status-${product.id}" value="instock" type="radio" ${
          product.manage_stock
            ? ""
            : product.stock_status === "instock"
            ? "checked"
            : ""
        }> В наличии</label>
        <label><input class="change-stock--instock" required="required" ${
          product.manage_stock ? "disabled" : ""
        } name="stock_status-${product.id}" value="outofstock" type="radio" ${
          product.manage_stock
            ? ""
            : product.stock_status === "outofstock"
            ? "checked"
            : ""
        }> Нет в наличии</label>
        <!-- Product type (hidden) -->
        <input name="product_type-${product.id}" value="${
          productData.product_type
        }" type="hidden">
        <!-- Product id (hidden) -->
        <input name="variable_id-${product.id}" value="${
          productData.product_type === "variation" ? idSelected : ""
        }" type="hidden">
      </fieldset>`;
      })
      .join(" ");
    cell.innerHTML = `
        <form class="change-stock--form">
          ${fieldsHtml}
          <input class="btn change-stock--submit-button" type="button" value="OK">
        </form>`;

    const form = cell.querySelector(".change-stock--form");
    const formfields = form.querySelectorAll(".change-stock--form fieldset");
    const submitButton = form.querySelector(".change-stock--submit-button");

    formfields.forEach((field) => {
      const inputManage = field.querySelector(".change-stock--manage-stock");
      const inputNumber = field.querySelector(".change-stock--input-number");
      const inputInStock = field.querySelectorAll(".change-stock--instock");

      inputManage.addEventListener("change", () => {
        inputNumber.toggleAttribute("disabled");
        inputInStock.forEach((input) => input.toggleAttribute("disabled"));
      });
    });

    submitButton.addEventListener("click", function () {
      if (!form.reportValidity()) {
        return;
      }

      const FD = new FormData(form);
      const updateProps = {};
      FD.forEach((value, key) => {
        const [prop, id] = key.split("-");

        if (!updateProps[id]) {
          updateProps[id] = [];
        }
        updateProps[id].push({ [prop]: value });
      });

      document.removeEventListener("click", exitUpdateStockListener);

      const authToken = localStorage.getItem("authToken");
      const authTokenExpires = localStorage.getItem("authTokenExpires");
      if (!(Date.now() < authTokenExpires || authToken)) {
        alert(
          "Токен доступа не указан или его срок жизни истек. Необходима повторная авторизация."
        );
        localStorage.removeItem("authToken");
        localStorage.removeItem("username");
        localStorage.removeItem("authTokenExpires");
        return (window.location.href = "/auth/login");
      }

      fetch(
        `/stocks/woo/update_stock
          `,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(updateProps),
        }
      )
        .then((response) => {
          if (response.ok) {
            const newValue = Object.values(updateProps).some((props) => {
              return props.some((prop) => {
                return (
                  prop["manage_stock"] === true ||
                  prop["stock_quantity"] > 0 ||
                  prop["stock_status"] === "instock"
                );
              });
            });

            cell.textContent = newValue ? "Есть" : "Нет";
          } else {
            cell.textContent = oldValue;
            if (response.status === 403) {
              alert("Вы не авторизованы!");
            }
          }
        })
        .catch((error) => console.log(error));
    });

    const exitUpdateStockListener = (e) => {
      if (
        e.target !== cell &&
        e.target.nodeName !== "INPUT" &&
        e.target.nodeName !== "FIELDSET" &&
        e.target.nodeName !== "LABEL"
      ) {
        cell.textContent = oldValue;
        document.removeEventListener("click", exitUpdateStockListener);
      }
    };

    document.addEventListener("click", exitUpdateStockListener);
  }
};
fbsCells.addEventListener("click", updateStockListener);
