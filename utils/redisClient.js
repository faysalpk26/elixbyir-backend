const { createClient } = require("redis");
const dotenv = require("dotenv");
const logger = require("./logger");

dotenv.config();

const useLocalRedisFallback =
  process.env.NODE_ENV !== "production" &&
  process.env.REDIS_DISABLE_LOCAL !== "true";

const redisUrl =
  process.env.REDIS_URL ||
  (useLocalRedisFallback ? "redis://127.0.0.1:6379" : "");

const redisEnabled =
  process.env.REDIS_ENABLED !== "false" && Boolean(redisUrl);

const rawClient = redisEnabled ? createClient({ url: redisUrl }) : null;
let redisReady = false;

if (rawClient) {
  rawClient.on("ready", () => {
    redisReady = true;
    logger.info("redis_ready");
  });

  rawClient.on("end", () => {
    redisReady = false;
    logger.warn("redis_connection_closed");
  });

  rawClient.on("error", (err) => {
    redisReady = false;
    logger.warn("redis_client_error", {
      error: err.message,
      code: err.code,
    });
  });
}

function isRedisReady() {
  return Boolean(rawClient && redisReady && rawClient.isOpen);
}

async function connectRedis() {
  if (!redisEnabled) {
    logger.info("redis_disabled", {
      reason: redisUrl
        ? "REDIS_ENABLED=false"
        : "No REDIS_URL configured for this environment",
    });
    return false;
  }

  if (isRedisReady()) {
    return true;
  }

  try {
    if (!rawClient.isOpen) {
      await rawClient.connect();
    }
    redisReady = true;
    logger.info("redis_connected", { redis_url: redisUrl });
    return true;
  } catch (error) {
    redisReady = false;
    logger.warn("redis_connect_failed_fallback_mode", {
      error: error.message,
      redis_url: redisUrl,
    });
    return false;
  }
}

async function getJSON(key) {
  if (!isRedisReady()) return null;
  try {
    const value = await rawClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn("redis_get_json_failed", { key, error: error.message });
    return null;
  }
}

async function setJSON(key, value, ttlSeconds = 600) {
  if (!isRedisReady()) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await rawClient.setEx(key, ttlSeconds, serialized);
    } else {
      await rawClient.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.warn("redis_set_json_failed", { key, error: error.message });
    return false;
  }
}

async function delKey(key) {
  if (!isRedisReady()) return 0;
  try {
    return await rawClient.del(key);
  } catch (error) {
    logger.warn("redis_del_failed", { key, error: error.message });
    return 0;
  }
}

const safeClient = {
  get isOpen() {
    return isRedisReady();
  },
  async del(...keys) {
    if (!isRedisReady()) return 0;
    try {
      return await rawClient.del(...keys);
    } catch (error) {
      logger.warn("redis_client_del_failed", { error: error.message });
      return 0;
    }
  },
  async sMembers(key) {
    if (!isRedisReady()) return [];
    try {
      return await rawClient.sMembers(key);
    } catch (error) {
      logger.warn("redis_smembers_failed", { key, error: error.message });
      return [];
    }
  },
  async sAdd(key, value) {
    if (!isRedisReady()) return 0;
    try {
      return await rawClient.sAdd(key, value);
    } catch (error) {
      logger.warn("redis_sadd_failed", { key, error: error.message });
      return 0;
    }
  },
  async *scanIterator(options = {}) {
    if (!isRedisReady()) return;
    try {
      for await (const key of rawClient.scanIterator(options)) {
        yield key;
      }
    } catch (error) {
      logger.warn("redis_scan_iterator_failed", { error: error.message });
    }
  },
};

module.exports = {
  client: safeClient,
  connectRedis,
  getJSON,
  setJSON,
  delKey,
  isRedisReady,
};
