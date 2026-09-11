import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const toolchainRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(process.env.TAVERN_PROJECT_ROOT ?? process.cwd());
const action = process.argv[2] ?? 'build';

if (!['build', 'dev', 'watch'].includes(action)) {
  console.error(`[tavern-toolchain] Unknown action: ${action}`);
  console.error('[tavern-toolchain] Expected one of: build, dev, watch');
  process.exit(2);
}

const webpackCli = path.join(toolchainRoot, 'node_modules', 'webpack-cli', 'bin', 'cli.js');
if (!fs.existsSync(webpackCli)) {
  console.error('[tavern-toolchain] Shared Toolchain dependencies are not installed.');
  console.error(`[tavern-toolchain] Install them once in: ${toolchainRoot}`);
  process.exit(1);
}

const mode = action === 'build' ? 'production' : 'development';
const args = ['--config', path.join(toolchainRoot, 'webpack.config.ts'), '--mode', mode];
if (action === 'watch') {
  args.push('--watch', '--progress');
}

console.info(`[tavern-toolchain] ${action}: ${projectRoot}`);

const child = spawn(process.execPath, [webpackCli, ...args], {
  // Keep the webpack process rooted in the shared Toolchain so plugins that
  // resolve their own packages (for example unplugin-auto-import) see the
  // Toolchain node_modules. Project source/output still use TAVERN_PROJECT_ROOT.
  cwd: toolchainRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    TAVERN_PROJECT_ROOT: projectRoot,
    NODE_PATH: [path.join(toolchainRoot, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
  },
});

child.on('exit', code => {
  process.exitCode = code ?? 1;
});

child.on('error', error => {
  console.error(`[tavern-toolchain] Failed to start webpack: ${error.message}`);
  process.exitCode = 1;
});
