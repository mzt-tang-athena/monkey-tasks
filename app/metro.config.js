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

// The schemas package uses Node-style relative imports written with a
// ".js" extension, for example "./vocabulary.js" beside
// "vocabulary.ts". Metro looks for the literal ".js" file only. For
// relative imports inside the contracts package, strip the extension
// so the TS source resolves.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const relative = moduleName.startsWith("./") || moduleName.startsWith("../");
  const inContracts = (context.originModulePath ?? "").includes(
    "contracts/packages/schemas",
  );
  if (relative && inContracts && moduleName.endsWith(".js")) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
