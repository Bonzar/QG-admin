const path = require("path");
const express = require("express");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

//Устанавливаем соединение с mongoose
const mongoose = require("mongoose");
const dev_db_url =
  "mongodb+srv://bonzar-stocks:wibzut-gutNy5-jistad@cluster0.9oysia7.mongodb.net/?retryWrites=true&w=majority";
const mongoDB = process.env.MONGODB_URI || dev_db_url;
mongoose.connect(mongoDB);
// mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const projectsRouter = require("./routes/projects");

const compression = require("compression");
const helmet = require("helmet");

const app = express();

app.set("view engine", "pug");
app.set("views", "./views");

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/projects", projectsRouter);

app.use(helmet());
app.use(compression()); // Compress all routes

module.exports = app;
