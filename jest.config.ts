import type { Config } from '@jest/types';

export default async (): Promise<Config.InitialOptions> => ({
    verbose: true,
    preset: 'ts-jest',
    testEnvironment: 'node',
    testRunner: 'jest-circus/runner',
    testTimeout: 20_000,
    collectCoverage: false, // If true it messes the injection script and the browser is not able to execute it.
    maxWorkers: 3,
    globals: {
        'ts-jest': {
            tsconfig: '<rootDir>/test/tsconfig.json',
        },
    },
});
