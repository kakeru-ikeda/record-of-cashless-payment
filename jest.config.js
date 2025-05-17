/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^chalk$': '<rootDir>/tests/mocks/chalkMock.js'
  },
  setupFilesAfterEnv: ['./tests/jest.setup.js'],
  // タイムアウト処理の改善
  testTimeout: 10000,
  // テスト終了時に未解決のプロミスやタイマーを検出
  detectOpenHandles: true,
  // 必要に応じて強制終了を有効化
  forceExit: true,
};
