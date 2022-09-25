const path = require("path");
const express = require("express");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const apiRouter = require("./routes/api"); //Import routes for "api" area of site

const app = express();

const buildPath = path.join(__dirname, "..", "dist");
app.use(express.static(buildPath));

app.use("/api", apiRouter);

module.exports = app;
