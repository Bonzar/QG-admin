const ozonService = require("../services/ozonService");
const ObjectsToCsv = require("objects-to-csv");

module.exports.getOzonShipment = async (req, res) => {
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
  } catch (e) {
    console.log(e);
    res
      .status(400)
      .json({ message: "Ошибка при получении поставки.", error: e });
  }
};
