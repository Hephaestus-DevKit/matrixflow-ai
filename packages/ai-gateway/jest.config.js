module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { statements: 30, branches: 15, functions: 30, lines: 35 },
  },
};
