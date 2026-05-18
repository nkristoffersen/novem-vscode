import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // VS Code's integrated terminal sets ELECTRON_RUN_AS_NODE=1, which leaks
        // into the child process and causes the downloaded Electron binary to
        // start in Node mode, rejecting every VS Code CLI flag as "bad option".
        // See https://github.com/electron/electron/issues/18412
        delete process.env.ELECTRON_RUN_AS_NODE;

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
