import jwt from "jsonwebtoken";

export const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (req.method === "OPTION") {
      next();
    }

    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(403).json({ message: "User not authorize." });
      }
      const { roles: userRoles } = jwt.verify(token, process.env.JWT_SECRET);
      let hasRoles = userRoles.some((role) => roles.includes(role));
      if (!hasRoles) {
        return res.status(403).json({ message: "У вас нет доступа" });
      }

      next();
    } catch (e) {
      console.log(e);
      return res.status(403).json({ message: "User not authorize." });
    }
  };
};
