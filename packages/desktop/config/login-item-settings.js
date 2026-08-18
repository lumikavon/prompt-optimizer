const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const LEGACY_DEVELOPMENT_LOGIN_ITEM_NAME = 'electron.app.Electron';
const WINDOWS_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const SILENT_START_ARG = '--hidden';
const execFileAsync = promisify(execFile);

function shouldManageSystemAutoLaunch({ isPackaged } = {}) {
  return Boolean(isPackaged);
}

function buildLoginItemSettings({
  isPackaged,
  platform = process.platform,
  execPath = process.execPath,
  enabled,
  silent,
} = {}) {
  if (!shouldManageSystemAutoLaunch({ isPackaged })) return null;

  if (platform === 'win32') {
    return {
      openAtLogin: Boolean(enabled),
      path: execPath,
      args: silent ? [SILENT_START_ARG] : [],
    };
  }

  if (platform === 'darwin') {
    return {
      openAtLogin: Boolean(enabled),
      openAsHidden: Boolean(silent),
    };
  }

  return null;
}

function parseLegacyDevelopmentLoginItem(regQueryOutput) {
  if (typeof regQueryOutput !== 'string') return null;

  const valueLine = regQueryOutput
    .split(/\r?\n/)
    .find((line) => /^\s*electron\.app\.Electron\s+REG_(?:SZ|EXPAND_SZ)\s+/i.test(line));
  if (!valueLine) return null;

  const valueMatch = valueLine.match(
    /^\s*electron\.app\.Electron\s+REG_(?:SZ|EXPAND_SZ)\s+(.+?)\s*$/i,
  );
  const commandMatch = valueMatch?.[1]?.match(/^"([^"]+)"\s+--hidden$/i);
  if (!commandMatch) return null;

  const executablePath = commandMatch[1];
  const normalizedPath = executablePath.replace(/\\/g, '/').toLowerCase();
  if (
    !normalizedPath.endsWith('/electron.exe') ||
    !/(^|\/)prompt-optimizer(\/|$)/.test(normalizedPath)
  ) {
    return null;
  }

  return {
    name: LEGACY_DEVELOPMENT_LOGIN_ITEM_NAME,
    path: executablePath,
    args: [SILENT_START_ARG],
  };
}

async function removeLegacyDevelopmentLoginItem({ run = execFileAsync } = {}) {
  let queryResult;
  try {
    queryResult = await run(
      'reg.exe',
      ['query', WINDOWS_RUN_KEY, '/v', LEGACY_DEVELOPMENT_LOGIN_ITEM_NAME],
      { encoding: 'utf8', windowsHide: true },
    );
  } catch (error) {
    if (error?.code === 1 || error?.code === '1') return false;
    throw error;
  }

  const legacyItem = parseLegacyDevelopmentLoginItem(queryResult?.stdout);
  if (!legacyItem) return false;

  await run(
    'reg.exe',
    ['delete', WINDOWS_RUN_KEY, '/v', LEGACY_DEVELOPMENT_LOGIN_ITEM_NAME, '/f'],
    { encoding: 'utf8', windowsHide: true },
  );
  return true;
}

module.exports = {
  buildLoginItemSettings,
  parseLegacyDevelopmentLoginItem,
  removeLegacyDevelopmentLoginItem,
  shouldManageSystemAutoLaunch,
};
