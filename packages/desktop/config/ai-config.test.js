const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const {
  getAiConfigPath,
  loadAiConfig,
  applyAiConfigToEnv,
  extractOpenAiConfig,
  readAiConfig,
  saveAiConfig,
} = require('./ai-config');

test('getAiConfigPath 默认使用 ~/.config/ai.yml', () => {
  delete process.env.AI_CONFIG_FILE;
  assert.strictEqual(
    getAiConfigPath(),
    path.join(os.homedir(), '.config', 'ai.yml')
  );
});

test('getAiConfigPath 支持 AI_CONFIG_FILE 覆盖', () => {
  process.env.AI_CONFIG_FILE = '/tmp/custom-ai.yml';
  assert.strictEqual(getAiConfigPath(), path.resolve('/tmp/custom-ai.yml'));
  delete process.env.AI_CONFIG_FILE;
});

test('extractOpenAiConfig 支持 ai.openai 与 .ai.openai', () => {
  const a = extractOpenAiConfig({ ai: { openai: { base_url: 'https://x/v1', api_key: 'k', model: 'm' } } });
  assert.deepStrictEqual(a, { base_url: 'https://x/v1', api_key: 'k', model: 'm' });

  const b = extractOpenAiConfig({ '.ai': { openai: { base_url: 'https://y/v1', api_key: 'k2' } } });
  assert.deepStrictEqual(b, { base_url: 'https://y/v1', api_key: 'k2', model: undefined });

  assert.strictEqual(extractOpenAiConfig({ ai: {} }), null);
  assert.strictEqual(extractOpenAiConfig({}), null);
  assert.strictEqual(extractOpenAiConfig(null), null);
  assert.strictEqual(extractOpenAiConfig({ ai: { openai: {} } }), null);
});

test('loadAiConfig 读取标准 ai.yml（顶层 ai.openai）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(
    file,
    [
      '# AI 配置',
      'ai:',
      '  openai:',
      '    base_url: https://api.openai.com/v1',
      '    api_key: sk-test-123',
      '    model: gpt-4o',
      '',
    ].join('\n')
  );
  process.env.AI_CONFIG_FILE = file;
  delete process.env.AI_OPENAI_BASE_URL;
  delete process.env.AI_OPENAI_API_KEY;
  delete process.env.AI_OPENAI_MODEL;

  const config = loadAiConfig();
  assert.deepStrictEqual(config, {
    base_url: 'https://api.openai.com/v1',
    api_key: 'sk-test-123',
    model: 'gpt-4o',
  });
  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadAiConfig 支持 .ai.openai 键名', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(file, '.ai:\n  openai:\n    api_key: sk-dot\n    model: gpt-4o-mini\n');
  process.env.AI_CONFIG_FILE = file;
  delete process.env.AI_OPENAI_BASE_URL;
  delete process.env.AI_OPENAI_API_KEY;
  delete process.env.AI_OPENAI_MODEL;

  const config = loadAiConfig();
  assert.strictEqual(config.api_key, 'sk-dot');
  assert.strictEqual(config.model, 'gpt-4o-mini');

  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadAiConfig 文件不存在返回 null', () => {
  process.env.AI_CONFIG_FILE = path.join(os.tmpdir(), 'no-such-ai-file.yml');
  delete process.env.AI_OPENAI_BASE_URL;
  delete process.env.AI_OPENAI_API_KEY;
  delete process.env.AI_OPENAI_MODEL;
  assert.strictEqual(loadAiConfig(), null);
  delete process.env.AI_CONFIG_FILE;
});

test('loadAiConfig 解析失败返回 null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(file, 'ai: [unclosed\n  openai:\n');
  process.env.AI_CONFIG_FILE = file;
  delete process.env.AI_OPENAI_BASE_URL;
  delete process.env.AI_OPENAI_API_KEY;
  delete process.env.AI_OPENAI_MODEL;
  assert.strictEqual(loadAiConfig(), null);
  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadAiConfig 环境变量优先于配置文件', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(file, 'ai:\n  openai:\n    api_key: sk-file\n    model: file-model\n');
  process.env.AI_CONFIG_FILE = file;
  process.env.AI_OPENAI_API_KEY = 'sk-env';
  process.env.AI_OPENAI_MODEL = 'env-model';
  process.env.AI_OPENAI_BASE_URL = 'https://env/v1';

  const config = loadAiConfig();
  assert.strictEqual(config.api_key, 'sk-env');
  assert.strictEqual(config.model, 'env-model');
  assert.strictEqual(config.base_url, 'https://env/v1');

  delete process.env.AI_CONFIG_FILE;
  delete process.env.AI_OPENAI_BASE_URL;
  delete process.env.AI_OPENAI_API_KEY;
  delete process.env.AI_OPENAI_MODEL;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyAiConfigToEnv 注入 VITE_CUSTOM_API_* 环境变量', () => {
  delete process.env.VITE_CUSTOM_API_KEY;
  delete process.env.VITE_CUSTOM_API_BASE_URL;
  delete process.env.VITE_CUSTOM_API_MODEL;

  applyAiConfigToEnv({ base_url: 'https://api/v1', api_key: 'sk-abc', model: 'gpt-5' });
  assert.strictEqual(process.env.VITE_CUSTOM_API_KEY, 'sk-abc');
  assert.strictEqual(process.env.VITE_CUSTOM_API_BASE_URL, 'https://api/v1');
  assert.strictEqual(process.env.VITE_CUSTOM_API_MODEL, 'gpt-5');

  // 空配置不改变环境变量
  applyAiConfigToEnv(null);
  assert.strictEqual(process.env.VITE_CUSTOM_API_KEY, 'sk-abc');
});

// ===== readAiConfig / saveAiConfig =====

test('readAiConfig 读取文件中的 .ai.openai 配置', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(file, 'ai:\n  openai:\n    base_url: https://x/v1\n    api_key: sk-x\n    model: m1\n');
  process.env.AI_CONFIG_FILE = file;
  const result = readAiConfig();
  assert.strictEqual(result.error, null);
  assert.deepStrictEqual(result.config, { base_url: 'https://x/v1', api_key: 'sk-x', model: 'm1' });
  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('readAiConfig 文件不存在时返回 error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  process.env.AI_CONFIG_FILE = path.join(dir, 'missing.yml');
  const result = readAiConfig();
  assert.strictEqual(result.config, null);
  assert.ok(result.error.includes('不存在'));
  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('saveAiConfig 修改已有配置并保留注释与其他段落', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(
    file,
    [
      '# 顶部注释',
      'ai:',
      '  openai:',
      '    base_url: https://old/v1',
      '    api_key: sk-old',
      '    model: old-model',
      '  codex:',
      '    provider: newapi',
    ].join('\n') + '\n'
  );
  process.env.AI_CONFIG_FILE = file;
  const result = saveAiConfig({ base_url: 'http://127.0.0.1:30000/v1', api_key: 'sk-new', model: 'gpt-5.6' });
  assert.strictEqual(result.ok, true);
  const raw = fs.readFileSync(file, 'utf-8');
  // 注释保留
  assert.ok(raw.includes('# 顶部注释'));
  // 其他段落保留
  assert.ok(raw.includes('codex:') && raw.includes('provider: newapi'));
  // 新值生效且 YAML 可解析
  const parsed = yaml.load(raw);
  assert.deepStrictEqual(parsed.ai.openai, { base_url: 'http://127.0.0.1:30000/v1', api_key: 'sk-new', model: 'gpt-5.6' });
  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('saveAiConfig 支持 .ai 顶层键名', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  const file = path.join(dir, 'ai.yml');
  fs.writeFileSync(file, '.ai:\n  openai:\n    base_url: https://old/v1\n');
  process.env.AI_CONFIG_FILE = file;
  saveAiConfig({ base_url: 'https://new/v1', api_key: 'sk-new', model: 'm2' });
  const parsed = yaml.load(fs.readFileSync(file, 'utf-8'));
  assert.deepStrictEqual(parsed['.ai'].openai, { base_url: 'https://new/v1', api_key: 'sk-new', model: 'm2' });
  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('saveAiConfig 无 openai 段时自动创建；文件不存在时创建新文件', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-config-test-'));
  // 1) 已有 ai 段但无 openai
  const file1 = path.join(dir, 'a1.yml');
  fs.writeFileSync(file1, 'ai:\n  codex:\n    model: x\n');
  process.env.AI_CONFIG_FILE = file1;
  saveAiConfig({ base_url: 'https://b/v1', api_key: 'k', model: 'm' });
  let parsed = yaml.load(fs.readFileSync(file1, 'utf-8'));
  assert.deepStrictEqual(parsed.ai.openai, { base_url: 'https://b/v1', api_key: 'k', model: 'm' });
  assert.strictEqual(parsed.ai.codex.model, 'x'); // 原有段保留

  // 2) 文件不存在
  const file2 = path.join(dir, 'a2.yml');
  process.env.AI_CONFIG_FILE = file2;
  saveAiConfig({ base_url: 'https://c/v1', api_key: 'k2', model: 'm2' });
  parsed = yaml.load(fs.readFileSync(file2, 'utf-8'));
  assert.deepStrictEqual(parsed.ai.openai, { base_url: 'https://c/v1', api_key: 'k2', model: 'm2' });

  delete process.env.AI_CONFIG_FILE;
  fs.rmSync(dir, { recursive: true, force: true });
});
