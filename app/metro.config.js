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

// The contracts package uses TypeScript NodeNext-style imports
// ("./vocabulary.js"). Some resolver paths do not map that onto the
// .ts source, so retry with the .ts name before giving up.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(
        context,
        `${moduleName.slice(0, -3)}.ts`,
        platform,
      );
    } catch (_error) {
      // No .ts sibling; fall through to the default resolver.
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
