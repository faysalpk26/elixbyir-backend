// backend/realtime/socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const StaffUser = require("../models/staffUsersModel");
const Role = require("../models/roleModel");
const { JWT_SECRET } = require("../middleware/rbac-middleware");
const { parseCookieHeader } = require("../utils/tokenExtractor");
const { STAFF_AUTH_COOKIE_NAME } = require("../utils/staffAuthCookie");

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://pink-dreams-ikftech.vercel.app",
        "https://pink-dreams-ikftech.vercel.app/",
        "https://pink-dream-local-frontend.vercel.app",
        process.env.FRONTEND_URL,
      ].filter(Boolean),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const authToken = String(socket.handshake.auth?.token || "").trim();
      const cookieToken =
        parseCookieHeader(socket.handshake.headers?.cookie || "")[
          STAFF_AUTH_COOKIE_NAME
        ] || "";

      const token =
        authToken && authToken !== "null" && authToken !== "undefined"
          ? authToken
          : cookieToken;

      if (!token) return next(new Error("No token"));

      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.type !== "staffUser") return next(new Error("Forbidden"));

      const staff = await StaffUser.findById(payload.id).lean();
      if (!staff) return next(new Error("Not found"));

      const role = await Role.findOne({ name: staff.role }).lean();
      const permissions = role?.permissions || [];

      socket.data.staffUser = staff;
      socket.data.permissions = permissions;

      const canReceive = permissions.includes("notifications:read");
      if (canReceive) {
        permissions.forEach((p) => socket.join(`perm:${p}`));
      }

      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.emit("ready", { ok: true });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket not initialized");
  return io;
}

module.exports = { initSocket, getIO };
