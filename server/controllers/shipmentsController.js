const ozonService = require("../services/ozonService");
const wbService = require("../services/wbService");
const ObjectsToCsv = require("objects-to-csv");

exports.getOzonShipment = async (req, res) => {
  try {
    const ozonShipmentProducts = await ozonService.getOzonShipment();

    ozonShipmentProducts.sort((product1, product2) => {
      return product1.name.localeCompare(product2.name);
    });

    const csvOzonShipment = new ObjectsToCsv(ozonShipmentProducts);

    res
      .status(200)
      .attachment(`ozonShipment.csv`)
      .send(await csvOzonShipment.toString());
  } catch (error) {
    console.log(error);
    res.status(400).json({
      error,
      message: `Ошибка при получении поставки Ozon. - ${error.message}`,
    });
  }
};

exports.getWbShipment = async (req, res) => {
  try {
    const wbShipmentProducts = await wbService.getWbShipment(req.body);

    wbShipmentProducts.sort((product1, product2) => {
      return product1.name.localeCompare(product2.name);
    });

    const csvWbShipment = new ObjectsToCsv(wbShipmentProducts);

    res
      .status(200)
      .attachment(`wbShipment.csv`)
      .send(await csvWbShipment.toString());
  } catch (error) {
    console.log(error);
    res.status(400).json({
      error,
      message: `Ошибка при получении поставки WB. - ${error.message}`,
    });
  }
};
