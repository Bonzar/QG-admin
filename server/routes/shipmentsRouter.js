import express from "express";
import * as shipmentsController from "../controllers/shipmentsController.js";

const router = express.Router();

router.get("/", (req, res) => {
  try {
    res.render("shipments", { title: "Поставки" });
  } catch (e) {
    console.log(e);
    res.status(400).json({
      message: "Ошибка при загрузке страницы с поставками. Попробуйте позже.",
    });
  }
});

router.post("/ozon", shipmentsController.getOzonShipment);
router.post("/wb", shipmentsController.getWbShipment);

export default router;
