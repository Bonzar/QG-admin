var express = require("express");
var router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

router.get("/cool/", function (req, res, next) {
  res.send("You're so cool");
});

module.exports = router;

//

// mongodb+srv://bonzar:nukqUf-9pohbu-xopdib@locallibrary.cxbs7zn.mongodb.net/?retryWrites=true&w=majority
