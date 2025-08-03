const baseConfig = require('./jest.config.js');

module.exports = {
    ...baseConfig,
    displayName: 'Integration Tests',
    testMatch: [
        '<rootDir>/tests/integration/**/*.test.ts',
        '<rootDir>/tests/integration/**/*.integration.test.ts'
    ],
    setupFilesAfterEnv: [
        '<rootDir>/tests/jest.setup.js',
        '<rootDir>/tests/integration/integration.setup.ts'
    ],
    testTimeout: 30000, // インテグレーションテストは時間がかかる可能性があるため
    collectCoverageFrom: [
        'shared/**/*.ts',
        'src/**/*.ts',
        'functions/src/**/*.ts',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!tests/**'
    ],
    coverageDirectory: '<rootDir>/coverage/integration',
    coverageReporters: ['html', 'lcov', 'text']
};
