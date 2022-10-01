const path = require("path");
const express = require("express");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const projectsRouter = require("./routes/projects");
const indexRouter = require("./routes/index");

const compression = require("compression");
const helmet = require("helmet");

const app = express();

app.set("view engine", "pug");
app.set("views", "./views");

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

app.use("/", indexRouter);
app.use("/projects", projectsRouter);

app.use(helmet());
app.use(compression()); // Compress all routes

module.exports = app;
