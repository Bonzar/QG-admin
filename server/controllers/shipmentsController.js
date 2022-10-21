const ozonService = require("../services/ozonService");
const wbService = require("../services/wbService");
const ObjectsToCsv = require("objects-to-csv");

exports.getOzonShipment = async (req, res) => {
  try {
    const ozonShipmentProducts = await ozonService.getOzonShipment();

    console.log(ozonShipmentProducts);

    ozonShipmentProducts.sort((product1, product2) => {
      return product1.name.localeCompare(product2.name);
    });

    const csvOzonShipment = new ObjectsToCsv(ozonShipmentProducts);

    res
      .status(200)
      .attachment(`ozonShipment.csv`)
      .send(await csvOzonShipment.toString());
  } catch (e) {
    console.log(e);
    res
      .status(400)
      .json({ message: "Ошибка при получении поставки Ozon.", error: e });
  }
};

exports.getWbShipment = (req, res) => {
  try {
    wbService.getWbShipment(req.body, async (err, wbShipmentProducts) => {
      if (err) {
        console.log(err);
        res
          .status(400)
          .json({ message: "Ошибка при получении поставки WB", err });
        return;
      }

      wbShipmentProducts.sort((product1, product2) => {
        return product1.name.localeCompare(product2.name);
      });

      const csvWbShipment = new ObjectsToCsv(wbShipmentProducts);

      res
        .status(200)
        .attachment(`wbShipment.csv`)
        .send(await csvWbShipment.toString());
    });
  } catch (e) {
    console.log(e);
    res
      .status(400)
      .json({ message: "Ошибка при получении поставки WB.", error: e });
  }
};
