const path = require("path");
const express = require("express");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const redis = require("redis");
const redisClient = redis.createClient({
  url: "redis://default:AFSvKK3cNgIw3E0jlxvaSC81wOQQuNBQ@redis-17048.c3.eu-west-1-2.ec2.cloud.redislabs.com:17048",
});
redisClient.on("error", (err) => console.log("Redis Client Error", err));
(async () => {
  // Connect to redis server
  await redisClient.connect();
})();

const projectsRouter = require("./routes/projects");
const indexRouter = require("./routes/index");

const app = express();

app.set("view engine", "pug");
app.set("views", "./views");

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/", indexRouter);
app.use("/projects", projectsRouter);

module.exports.redisClient = redisClient;
module.exports = app;
// module.exports = redisClient;

// redis://:
// redis://default:AFSvKK3cNgIw3E0jlxvaSC81wOQQuNBQ@redis-17048.c3.eu-west-1-2.ec2.cloud.redislabs.com:17048/11243867
