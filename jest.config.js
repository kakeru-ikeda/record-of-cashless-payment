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
    '^chalk$': '<rootDir>/tests/mocks/chalkMock.js',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@usecase/(.*)$': '<rootDir>/src/usecases/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1'
  },
  setupFilesAfterEnv: ['./tests/jest.setup.js'],
  // タイムアウト処理の改善
  testTimeout: 10000,
  // テスト終了時に未解決のプロミスやタイマーを検出
  detectOpenHandles: true,
  // 必要に応じて強制終了を有効化
  forceExit: true,
};
