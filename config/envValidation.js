const requireEnv = (key) => {
  const value = process.env[key];
  if (!value || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const validateRequiredEnv = () => {
  requireEnv("MONGODB_URI");
  requireEnv("JWT_SECRET");
  requireEnv("SESSION_SECRET");
};

module.exports = {
  requireEnv,
  validateRequiredEnv,
};
