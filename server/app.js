import path from "path";
import express from "express";
import indexRouter from "./routes/indexRouter.js";
import authRouter from "./routes/authRouter.js";
import stocksRouter from "./routes/stocksRouter.js";
import ordersRouter from "./routes/ordersRouter.js";
import shipmentsRouter from "./routes/shipmentsRouter.js";
import compression from "compression";
import helmet from "helmet";

if (process.env.NODE_ENV === "production") {
  const dotenv = await import("dotenv");
  dotenv.default.config();
}

try {
  //Устанавливаем соединение с mongoose
  const mongoose = (await import("mongoose")).default;
  const mongoDB = process.env.MONGODB_URI;
  mongoose.connect(mongoDB);
  const db = mongoose.connection;
  db.on("error", console.error.bind(console, "MongoDB connection error:"));
} catch (e) {
  console.log(e);
}

const app = express();

app.set("view engine", "pug");
app.set("views", "./views");

app.use(express.static(path.join("./", "..", "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/stocks", stocksRouter);
app.use("/orders", ordersRouter);
app.use("/shipments", shipmentsRouter);

app.use(helmet());
app.use(compression());

// Compress all routes
export default app;
