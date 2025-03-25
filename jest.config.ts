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
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/index.ts',
		'!src/types.ts',
		'!src/debug.ts',
		'!**/node_modules/**'
	],

	// Coverage thresholds
	coverageThreshold: {
		global: {
			branches: 85,
			functions: 85,
			lines: 85,
			statements: 85
		}
	},

	// Performance and execution
	testTimeout: 10_000,
	maxWorkers: '50%',

	// Reporting and debugging
	verbose: true,
	clearMocks: true,
	restoreMocks: true,

	bail: 5 // Stop running tests after 5 failures
};

export default config;
