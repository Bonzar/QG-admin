import ObjectsToCsv from "objects-to-csv";
import { Ozon } from "../services/ozonService.js";
import * as wbService from "../services/wbService.js";

export const getOzonShipment = async (req, res) => {
  try {
    const ozonShipmentProducts = await Ozon.getApiShipmentPredict(
      req.body.dateShiftDays,
      req.body.predictPeriodDays
    );

    ozonShipmentProducts.sort((product1, product2) => {
      return product1.name.localeCompare(product2.name);
    });

    const csvOzonShipment = new ObjectsToCsv(ozonShipmentProducts);

    res
      .status(200)
      .attachment(`ozonShipment.csv`)
      .send(await csvOzonShipment.toString());
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Ошибка при получении поставки Ozon. - ${error.message}`,
    });
  }
};

export const getWbShipment = async (req, res) => {
  try {
    const wb = new wbService.Wildberries();

    const wbShipmentProducts = await wb.getDevShipment(req.body);
    // const wbShipmentProducts = await wbService.getWbShipment(req.body);

    wbShipmentProducts.sort((product1, product2) => {
      return product1.name.localeCompare(product2.name);
    });

    const csvWbShipment = new ObjectsToCsv(wbShipmentProducts);

    res
      .status(200)
      .attachment(`wbShipment.csv`)
      .send(await csvWbShipment.toString());
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error,
      message: `Ошибка при получении поставки WB. - ${error.message}`,
    });
  }
};
