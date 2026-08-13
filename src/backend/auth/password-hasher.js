const { randomBytes, scrypt, timingSafeEqual } = require("crypto");
const { promisify } = require("util");
const { BackendError } = require("../errors");

const scryptAsync = promisify(scrypt);
const FORMAT = "scrypt$v1";
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function normalizePassword(password) {
  const value = String(password || "");
  if (!value) {
    throw new BackendError(400, "PASSWORD_REQUIRED", "密碼不可空白");
  }
  return value;
}

async function hashPassword(password, options = {}) {
  const value = normalizePassword(password);
  const salt = options.salt ? Buffer.from(options.salt) : randomBytes(SALT_BYTES);
  const derived = await scryptAsync(value, salt, KEY_LENGTH);
  return `${FORMAT}$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

async function verifyPassword(password, encodedHash) {
  const value = String(password || "");
  const parts = String(encodedHash || "").split("$");
  if (!value || parts.length !== 4 || `${parts[0]}$${parts[1]}` !== FORMAT) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[2], "base64url");
    expected = Buffer.from(parts[3], "base64url");
  } catch {
    return false;
  }
  if (!salt.length || expected.length !== KEY_LENGTH) return false;

  const actual = Buffer.from(await scryptAsync(value, salt, expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

module.exports = {
  FORMAT,
  hashPassword,
  verifyPassword
};
