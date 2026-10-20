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

// The schemas package imports its own files as "./x.js" (TypeScript
// node16 style). Metro cannot map that to "./x.ts" by default, so on
// failure retry once without the extension and let Metro pick the
// source extension itself.
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (baseResolveRequest) {
    try {
      return baseResolveRequest(context, moduleName, platform);
    } catch (_error) {
      // fall through to the extension retry below
    }
  }
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (/^\.\.?\/.*\.js$/.test(moduleName)) {
      return context.resolveRequest(
        context,
        moduleName.replace(/\.js$/, ""),
        platform,
      );
    }
    throw error;
  }
};

module.exports = config;
