module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      isolatedModules: true,
      allowJs: true
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@/implementations/(.*)$': '<rootDir>/src/implementations/$1',
    '^@/api/(.*)$': '<rootDir>/src/api/$1',
    '^@/dto/(.*)$': '<rootDir>/src/dto/$1',
    '^@/cli/(.*)$': '<rootDir>/src/cli/$1',
  },
  resolver: '<rootDir>/jest.resolver.cjs',
}; 