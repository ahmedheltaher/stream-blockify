import type { Config } from 'jest';

const config: Config = {
	// Core configuration
	preset: 'ts-jest',
	testEnvironment: 'node',

	// Test discovery
	roots: ['<rootDir>'],
	testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],

	// TypeScript processing
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.jest.json'
			}
		]
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],

	// Coverage configuration
	collectCoverage: true,
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts', '!src/types.ts', '!**/node_modules/**'],

	// Coverage thresholds
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80
		}
	},

	// Performance and execution
	testTimeout: 10_000,
	maxWorkers: '50%',

	// Reporting and debugging
	verbose: true,
	clearMocks: true,
	restoreMocks: true // Automatically restore mocks between tests

	// Uncomment when needed
	// setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	// bail: 5, // Stop running tests after 5 failures
};

export default config;
