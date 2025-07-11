/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/', '<rootDir>/tests/'],
    testMatch: ['**/tests/**/*.test.ts'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/functions/',
        '<rootDir>/tests/unit/functions/',
        '<rootDir>/tests/integration/'
    ],
    verbose: true,
    // タイムゾーンを日本時間に設定
    setupFilesAfterEnv: ['./tests/jest.setup.js'],
    globalSetup: '<rootDir>/tests/globalSetup.js',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/index.ts',
        "shared/**/*.{ts,tsx}",
        "!**/node_modules/**",
        "!**/dist/**",
        "!**/*.d.ts",
        // functionsディレクトリを除外
        "!functions/**/*.ts",
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
    // タイムアウト処理の改善
    testTimeout: 10000,
    // テスト終了時に未解決のプロミスやタイマーを検出
    detectOpenHandles: true,
    // 開いているハンドルを検出したときに詳細を表示
    verbose: true,
    // 強制終了
    forceExit: true,
};
