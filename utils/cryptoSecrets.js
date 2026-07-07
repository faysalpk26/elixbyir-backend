const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1";

function getKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is missing");
  }

  // 64-char hex -> 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // base64 32-byte key
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch (_) {
    // ignore
  }

  // fallback: derive 32-byte key from passphrase
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptSecret(plainText) {
  if (plainText === undefined || plainText === null || plainText === "") return "";
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decryptSecret(payload) {
  if (!payload) return "";
  if (!String(payload).startsWith(`${PREFIX}:`)) return String(payload);

  const parts = String(payload).split(":");
  if (parts.length !== 5) return "";

  const iv = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const encrypted = Buffer.from(parts[4], "base64");

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function maskSecret(value) {
  if (!value) return "";
  const s = String(value);
  if (s.length <= 8) return "*".repeat(s.length);
  return `${s.slice(0, 4)}${"*".repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
};
