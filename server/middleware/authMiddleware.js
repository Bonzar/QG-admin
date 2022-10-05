const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  if (req.method === "OPTION") {
    next();
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(403).json({ message: "User not authorize." });
    }
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    console.log(e);
    return res.status(403).json({ message: "User not authorize." });
  }
};
