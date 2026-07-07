const { createLogger, format, transports } = require("winston");

const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const sanitizeMetaValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const readableFormat = format.printf((info) => {
  const { timestamp, level: logLevel, message, stack, ...meta } = info;
  const suffixMeta = { ...meta };
  const service = suffixMeta.service || "backend";
  const env = suffixMeta.env || process.env.NODE_ENV || "development";
  delete suffixMeta.service;
  delete suffixMeta.env;

  const metaParts = Object.entries(suffixMeta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${sanitizeMetaValue(value)}`);

  const metaText = metaParts.length ? ` ${metaParts.join(" ")}` : "";
  const baseLine = `[${timestamp}] ${String(logLevel).toUpperCase()} ${message}${metaText} [${service}/${env}]`;

  if (stack) {
    return `${baseLine}\n${stack}`;
  }

  return baseLine;
});

const baseFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
  readableFormat,
);

const logger = createLogger({
  level,
  format: baseFormat,
  defaultMeta: {
    service: "pink-dreams-backend",
    env: process.env.NODE_ENV || "development",
  },
  transports: [new transports.Console()],
});

const normalizePayload = (payload) =>
  payload && typeof payload === "object" ? payload : { value: payload };

module.exports = {
  debug: (message, payload = {}) => logger.debug(message, normalizePayload(payload)),
  info: (message, payload = {}) => logger.info(message, normalizePayload(payload)),
  warn: (message, payload = {}) => logger.warn(message, normalizePayload(payload)),
  error: (message, payload = {}) => logger.error(message, normalizePayload(payload)),
};
