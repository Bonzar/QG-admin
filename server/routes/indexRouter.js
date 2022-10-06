const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index", {
    title: "Queridos Glitters - Admin",
  });
});

module.exports = router;
