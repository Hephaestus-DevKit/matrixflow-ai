module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { statements: 80, branches: 30, functions: 40, lines: 80 },
  },
};
