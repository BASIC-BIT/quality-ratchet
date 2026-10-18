export default [
  { ignores: ["node_modules/**", ".tmp/**", "test/fixtures/**"] },
  {
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "constructor-super": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-this-before-super": "error",
      "no-unexpected-multiline": "error",
      "no-unreachable": "error",
      "valid-typeof": "error",
    },
  },
];
