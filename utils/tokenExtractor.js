const { STAFF_AUTH_COOKIE_NAME } = require("./staffAuthCookie");

const PLACEHOLDER_TOKENS = new Set(["", "null", "undefined"]);

const parseCookieHeader = (cookieHeader = "") => {
  if (!cookieHeader || typeof cookieHeader !== "string") return {};

  return cookieHeader.split(";").reduce((acc, cookiePart) => {
    const [rawKey, ...rest] = cookiePart.split("=");
    if (!rawKey) return acc;
    const key = rawKey.trim();
    if (!key) return acc;

    const value = rest.join("=").trim();
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const normalizeBearerToken = (authorizationHeader = "") => {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return "";
  }

  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) return "";

  const token = authorizationHeader.slice(7).trim();
  if (PLACEHOLDER_TOKENS.has(token.toLowerCase())) return "";
  return token;
};

const getTokenFromRequest = (req, cookieName = STAFF_AUTH_COOKIE_NAME) => {
  const bearerToken = normalizeBearerToken(req?.header("Authorization"));
  if (bearerToken) return bearerToken;

  const cookieHeader = req?.headers?.cookie || "";
  const parsedCookies = parseCookieHeader(cookieHeader);
  const cookieToken = parsedCookies[cookieName];
  if (!cookieToken) return "";
  if (PLACEHOLDER_TOKENS.has(String(cookieToken).toLowerCase())) return "";
  return cookieToken;
};

module.exports = {
  parseCookieHeader,
  normalizeBearerToken,
  getTokenFromRequest,
};
