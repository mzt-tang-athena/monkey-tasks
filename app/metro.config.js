const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Monorepo: the schemas package lives in the contracts submodule.
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "contracts", "node_modules"),
];

module.exports = config;
