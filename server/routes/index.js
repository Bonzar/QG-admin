const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index", {
    title: "Vladisalav Navoyan aka Bonzar",
  });
});

module.exports = router;
