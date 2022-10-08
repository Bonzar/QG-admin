const path = require("path");
const express = require("express");

// if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
// }
try {
  //Устанавливаем соединение с mongoose
  const mongoose = require("mongoose");
  const mongoDB = process.env.MONGODB_URI;
  mongoose.connect(mongoDB);
  const db = mongoose.connection;
  db.on("error", console.error.bind(console, "MongoDB connection error:"));
} catch (e) {
  console.log(e);
}

const indexRouter = require("./routes/indexRouter");
const authRouter = require("./routes/authRouter");
const stocksRouter = require("./routes/stocksRouter");
const ordersRouter = require("./routes/ordersRouter");
const shipmentsRouter = require("./routes/shipmentsRouter");

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
app.use("/stocks", stocksRouter);
app.use("/orders", ordersRouter);
app.use("/shipments", shipmentsRouter);

app.use(helmet());
app.use(compression()); // Compress all routes

module.exports = app;
