const jwt = require("jsonwebtoken");
const { getTokenFromRequest } = require("./tokenExtractor");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const USER_AUTH_COOKIE_NAME =
  process.env.USER_AUTH_COOKIE_NAME || "user_access_token";

const resolveCheckoutUser = (req, requestedUserId) => {
  const token = getTokenFromRequest(req, USER_AUTH_COOKIE_NAME);
  const normalizedRequested = String(requestedUserId || "guest").trim();

  if (!token) {
    if (normalizedRequested && normalizedRequested.toLowerCase() !== "guest") {
      const err = new Error("Authentication required for this checkout request");
      err.statusCode = 401;
      throw err;
    }

    return {
      userId: "guest",
      isAuthenticated: false,
    };
  }

  let decoded = null;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    const err = new Error("Invalid authentication token");
    err.statusCode = 401;
    throw err;
  }

  const tokenUserId = String(
    decoded?.id || decoded?.user?.id || decoded?._id || "",
  ).trim();

  if (!tokenUserId) {
    const err = new Error("Invalid authenticated user");
    err.statusCode = 401;
    throw err;
  }

  if (
    normalizedRequested &&
    normalizedRequested.toLowerCase() !== "guest" &&
    normalizedRequested !== tokenUserId
  ) {
    const err = new Error("User identity mismatch in checkout request");
    err.statusCode = 403;
    throw err;
  }

  return {
    userId: tokenUserId,
    isAuthenticated: true,
  };
};

module.exports = {
  resolveCheckoutUser,
};
