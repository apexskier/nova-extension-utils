module.exports = {
  preset: "ts-jest",
  setupFiles: ["./src/test.setup.ts"],
  collectCoverageFrom: ["./src/**"],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
