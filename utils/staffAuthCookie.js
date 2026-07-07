const STAFF_AUTH_COOKIE_NAME =
  process.env.STAFF_AUTH_COOKIE_NAME || "staff_access_token";

const getCookieSameSite = () => {
  if (process.env.STAFF_AUTH_COOKIE_SAMESITE) {
    return process.env.STAFF_AUTH_COOKIE_SAMESITE;
  }
  return process.env.NODE_ENV === "production" ? "none" : "lax";
};

const getCookieSecure = () => {
  if (typeof process.env.STAFF_AUTH_COOKIE_SECURE === "string") {
    return process.env.STAFF_AUTH_COOKIE_SECURE === "true";
  }
  return process.env.NODE_ENV === "production";
};

const getStaffAuthCookieOptions = () => ({
  httpOnly: true,
  secure: getCookieSecure(),
  sameSite: getCookieSameSite(),
  path: "/",
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
});

module.exports = {
  STAFF_AUTH_COOKIE_NAME,
  getStaffAuthCookieOptions,
};
