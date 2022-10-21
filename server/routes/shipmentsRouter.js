const express = require("express");
const router = express.Router();

const shipmentsController = require("../controllers/shipmentsController");

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

router.get("/ozon", shipmentsController.getOzonShipment);
router.post("/wb", shipmentsController.getWbShipment);

module.exports = router;
