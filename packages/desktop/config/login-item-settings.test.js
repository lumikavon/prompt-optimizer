const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLoginItemSettings,
  parseLegacyDevelopmentLoginItem,
  removeLegacyDevelopmentLoginItem,
  shouldManageSystemAutoLaunch,
} = require('./login-item-settings');

test('development builds never manage system auto-launch entries', () => {
  assert.equal(shouldManageSystemAutoLaunch({ isPackaged: false }), false);
  assert.equal(
    buildLoginItemSettings({
      isPackaged: false,
      platform: 'win32',
      execPath: 'C:\\repo\\node_modules\\electron\\electron.exe',
      enabled: true,
      silent: true,
    }),
    null,
  );
});

test('packaged Windows builds register the product executable explicitly', () => {
  assert.deepEqual(
    buildLoginItemSettings({
      isPackaged: true,
      platform: 'win32',
      execPath: 'C:\\Program Files\\PromptOptimizer\\PromptOptimizer.exe',
      enabled: true,
      silent: true,
    }),
    {
      openAtLogin: true,
      path: 'C:\\Program Files\\PromptOptimizer\\PromptOptimizer.exe',
      args: ['--hidden'],
    },
  );

  assert.deepEqual(
    buildLoginItemSettings({
      isPackaged: true,
      platform: 'win32',
      execPath: 'C:\\Program Files\\PromptOptimizer\\PromptOptimizer.exe',
      enabled: false,
      silent: false,
    }),
    {
      openAtLogin: false,
      path: 'C:\\Program Files\\PromptOptimizer\\PromptOptimizer.exe',
      args: [],
    },
  );
});

test('packaged macOS builds retain the hidden-login setting without Windows options', () => {
  assert.deepEqual(
    buildLoginItemSettings({
      isPackaged: true,
      platform: 'darwin',
      enabled: true,
      silent: true,
    }),
    {
      openAtLogin: true,
      openAsHidden: true,
    },
  );
});

test('legacy registry parsing only accepts the prompt-optimizer development login item', () => {
  const matchingOutput = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run
    electron.app.Electron    REG_SZ    "D:\\work\\lumikavon\\prompt-optimizer\\node_modules\\.pnpm\\electron@41.1.0\\node_modules\\electron\\dist\\electron.exe" --hidden
`;

  assert.deepEqual(parseLegacyDevelopmentLoginItem(matchingOutput), {
    name: 'electron.app.Electron',
    path: 'D:\\work\\lumikavon\\prompt-optimizer\\node_modules\\.pnpm\\electron@41.1.0\\node_modules\\electron\\dist\\electron.exe',
    args: ['--hidden'],
  });

  for (const rejectedOutput of [
    matchingOutput.replace('electron.app.Electron', 'electron.app.LobsterAI'),
    matchingOutput.replace('prompt-optimizer', 'another-app'),
    matchingOutput.replace('electron.exe', 'PromptOptimizer.exe'),
    matchingOutput.replace('--hidden', '--auto-launched'),
  ]) {
    assert.equal(parseLegacyDevelopmentLoginItem(rejectedOutput), null);
  }
  assert.equal(parseLegacyDevelopmentLoginItem(null), null);
});

test('legacy cleanup queries and deletes only the exact verified Run value', async () => {
  const calls = [];
  const run = async (file, args, options) => {
    calls.push([file, args, options]);
    if (args[0] === 'query') {
      return {
        stdout: `    electron.app.Electron    REG_SZ    "D:\\work\\lumikavon\\prompt-optimizer\\node_modules\\electron\\dist\\electron.exe" --hidden\r\n`,
      };
    }
    return { stdout: 'The operation completed successfully.' };
  };

  assert.equal(await removeLegacyDevelopmentLoginItem({ run }), true);
  assert.deepEqual(calls, [
    [
      'reg.exe',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'electron.app.Electron'],
      { encoding: 'utf8', windowsHide: true },
    ],
    [
      'reg.exe',
      ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'electron.app.Electron', '/f'],
      { encoding: 'utf8', windowsHide: true },
    ],
  ]);
});

test('legacy cleanup leaves missing and non-matching Run values untouched', async () => {
  const missingRun = async () => {
    const error = new Error('The system was unable to find the specified registry value.');
    error.code = 1;
    throw error;
  };
  assert.equal(await removeLegacyDevelopmentLoginItem({ run: missingRun }), false);

  const calls = [];
  const nonMatchingRun = async (file, args, options) => {
    calls.push([file, args, options]);
    return {
      stdout: `    electron.app.Electron    REG_SZ    "D:\\work\\another-app\\electron.exe" --hidden\r\n`,
    };
  };
  assert.equal(await removeLegacyDevelopmentLoginItem({ run: nonMatchingRun }), false);
  assert.equal(calls.length, 1);
});
