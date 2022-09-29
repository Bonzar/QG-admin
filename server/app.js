const path = require("path");
const express = require("express");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const projectsRouter = require("./routes/projects");
const indexRouter = require("./routes/index");

const app = express();

app.set("view engine", "pug");
app.set("views", "./views");

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/", indexRouter);
app.use("/projects", projectsRouter);

module.exports = app;
