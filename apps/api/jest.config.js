module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@matrixflow/shared$': '<rootDir>/../../packages/shared/src',
    '^@matrixflow/db$': '<rootDir>/../../packages/db/src',
    '^@matrixflow/ai-gateway$': '<rootDir>/../../packages/ai-gateway/src',
    '^@matrixflow/workflow-engine$': '<rootDir>/../../packages/workflow-engine/src',
  },
  transform: { '^.+\\.ts$': 'ts-jest' },
};
