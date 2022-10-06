exports.clearName = (name, type = "marketplace") => {
  let formattedName = "";

  switch (type) {
    case "marketplace":
      formattedName = name
        .replaceAll(
          /[".:]|(Queridos Glir?tters)|(ГлиттерГель)|(Глиттер гель)|(Глиттер)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(набора)|(для блёсток)|(3\s?мл)|(6\s?мл)|(Блестки для глаз)/gi,
          ""
        )
        .replace("набор", "Набор:")
        .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ")
        .replace("Хайлайтер", "Хай")
        .trim();
      break;
    case "site":
      formattedName = name
        .split(" - ")[0]
        .replace(/Глиттер-гель/i, "")
        .replace(/Глиттер-набор/i, "Набор")
        .replace(/Хайлайтер/i, "Хай")
        .trim();
  }

  return formattedName;
};
