const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

const expoFlatArray = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

module.exports = defineConfig([
  {
    files: ["**/*"],
    ignores: ["dist/*"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  },
  ...expoFlatArray,
]);
