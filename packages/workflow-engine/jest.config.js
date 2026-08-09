module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { statements: 85, branches: 65, functions: 85, lines: 90 },
  },
};
