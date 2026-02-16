const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

let cachedConfig = null;

function loadConfig() {
  const configPath = path.join(__dirname, "config.yml");
  let raw;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    error.errorContext = `[Config Error]: Unable to read ${configPath}. Make sure config.yml exists.`;
    throw error;
  }

  let parsed;
  try {
    parsed = yaml.parse(raw) || {};
  } catch (error) {
    error.errorContext = `[Config Error]: Unable to parse ${configPath}. Check YAML syntax.`;
    throw error;
  }

  cachedConfig = parsed;
  return cachedConfig;
}

function getConfig() {
  if (!cachedConfig) return loadConfig();
  return cachedConfig;
}

module.exports = {
  getConfig,
  loadConfig,
  config: getConfig(),
};
