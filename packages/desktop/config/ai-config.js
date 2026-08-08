/**
 * AI 配置读取模块
 *
 * 从用户目录读取 AI 配置文件（~/.config/ai.yml），提取 OpenAI 兼容模型配置，
 * 作为应用"优化模型"的唯一来源（替代原模型管理界面）。
 *
 * 配置文件格式（YAML）：
 * ```yaml
 * ai:
 *   openai:
 *     base_url: https://api.openai.com/v1
 *     api_key: sk-xxx
 *     model: gpt-4o
 * ```
 * 兼容顶层键名带点号的形式（`.ai.openai`）：
 * ```yaml
 * .ai:
 *   openai:
 *     base_url: ...
 *     api_key: ...
 *     model: ...
 * ```
 *
 * 支持的环境变量覆盖：
 * - AI_CONFIG_FILE：指定配置文件路径（默认 ~/.config/ai.yml）
 * - AI_OPENAI_BASE_URL / AI_OPENAI_API_KEY / AI_OPENAI_MODEL：直接指定，优先级高于配置文件
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

// 配置读取结果缓存的全局标志（避免重复读取日志刷屏）
let lastLoadSummary = null;

/**
 * 获取配置文件路径
 * 优先级：AI_CONFIG_FILE 环境变量 > ~/.config/ai.yml
 */
function getAiConfigPath() {
  if (process.env.AI_CONFIG_FILE) {
    return path.resolve(process.env.AI_CONFIG_FILE);
  }
  return path.join(os.homedir(), '.config', 'ai.yml');
}

/**
 * 从配置对象中提取 openai 配置
 * 支持 `ai.openai` 与 `.ai.openai` 两种键名
 */
function extractOpenAiConfig(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const aiSection =
    (parsed && parsed.ai) ||
    (parsed && parsed['.ai']) ||
    null;

  if (!aiSection || typeof aiSection !== 'object') return null;

  const openai = aiSection.openai;
  if (!openai || typeof openai !== 'object') return null;

  const baseUrl = typeof openai.base_url === 'string' ? openai.base_url.trim() : '';
  const apiKey = typeof openai.api_key === 'string' ? openai.api_key.trim() : '';
  const model = typeof openai.model === 'string' ? openai.model.trim() : '';

  // 至少需要 api_key 和 model 之一才视为有效配置
  if (!baseUrl && !apiKey && !model) return null;

  return { base_url: baseUrl || undefined, api_key: apiKey || undefined, model: model || undefined };
}

/**
 * 读取并解析 AI 配置文件
 * @returns {{ base_url?: string, api_key?: string, model?: string } | null}
 */
function loadAiConfig() {
  // 1. 环境变量直接覆盖（最高优先级）
  const envBaseUrl = (process.env.AI_OPENAI_BASE_URL || '').trim();
  const envApiKey = (process.env.AI_OPENAI_API_KEY || '').trim();
  const envModel = (process.env.AI_OPENAI_MODEL || '').trim();
  if (envBaseUrl || envApiKey || envModel) {
    const envConfig = {
      base_url: envBaseUrl || undefined,
      api_key: envApiKey || undefined,
      model: envModel || undefined,
    };
    lastLoadSummary = `[ai-config] 使用环境变量 AI_OPENAI_* 作为优化模型配置`;
    return envConfig;
  }

  // 2. 读取配置文件
  const configPath = getAiConfigPath();
  if (!fs.existsSync(configPath)) {
    lastLoadSummary = `[ai-config] 配置文件不存在，跳过: ${configPath}`;
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw);
    const config = extractOpenAiConfig(parsed);
    if (!config) {
      lastLoadSummary = `[ai-config] 配置文件中未找到 ai.openai 配置，跳过: ${configPath}`;
      return null;
    }
    lastLoadSummary = `[ai-config] 已从配置文件加载优化模型配置: ${configPath} (model: ${config.model || '(未指定)'}, base_url: ${config.base_url || '(未指定)'})`;
    return config;
  } catch (error) {
    lastLoadSummary = `[ai-config] 解析配置文件失败: ${configPath} - ${error.message}`;
    return null;
  }
}

/**
 * 获取最近一次加载的结果摘要（用于日志输出）
 */
function getLastLoadSummary() {
  return lastLoadSummary || '[ai-config] 尚未加载配置';
}

/**
 * 将 AI 配置注入环境变量，使 core 模型管理器生成启用的 custom 模型
 * @param {{ base_url?: string, api_key?: string, model?: string }} config
 */
function applyAiConfigToEnv(config) {
  if (!config) return;
  if (config.api_key) process.env.VITE_CUSTOM_API_KEY = config.api_key;
  if (config.base_url) process.env.VITE_CUSTOM_API_BASE_URL = config.base_url;
  if (config.model) process.env.VITE_CUSTOM_API_MODEL = config.model;
  // 渲染进程会通过 config-getEnvironmentVariables 同步这些 VITE_* 变量
}

/**
 * 将 YAML 标量安全转义：仅含安全字符时保持裸值，否则使用双引号
 */
function yamlQuote(value) {
  const str = String(value ?? '');
  if (str === '') return '""';
  if (/^[A-Za-z0-9_.\-/]+$/.test(str)) return str;
  return JSON.stringify(str);
}

/**
 * 读取配置文件中的 .ai.openai 原始配置（不含环境变量覆盖）
 * @returns {{ config: {base_url?, api_key?, model?}|null, configPath: string, error: string|null }}
 */
function readAiConfig() {
  const configPath = getAiConfigPath();
  if (!fs.existsSync(configPath)) {
    return { config: null, configPath, error: `配置文件不存在: ${configPath}` };
  }
  try {
    const parsed = yaml.load(fs.readFileSync(configPath, 'utf-8'));
    return { config: extractOpenAiConfig(parsed), configPath, error: null };
  } catch (error) {
    return { config: null, configPath, error: `解析配置文件失败: ${error.message}` };
  }
}

/**
 * 保存 .ai.openai 配置到配置文件（保留注释与其他段落）
 * 支持 `ai:` 与 `.ai:` 两种顶层键名；段落不存在时自动追加
 * @param {{ base_url?: string, api_key?: string, model?: string }} next
 * @returns {{ ok: boolean, configPath: string, message: string }}
 */
function saveAiConfig(next = {}) {
  const configPath = getAiConfigPath();
  const fields = {};
  for (const field of ['base_url', 'api_key', 'model']) {
    const value = next[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      fields[field] = String(value).trim();
    }
  }

  let raw = '';
  let fileExisted = true;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch (_) {
    fileExisted = false;
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop(); // 去掉末尾空行

  // 定位顶层 ai 段（ai: 或 .ai:）
  let aiIdx = -1;
  let aiIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(\.?ai):\s*$/);
    if (m) {
      aiIdx = i;
      aiIndent = m[1].length;
      break;
    }
  }

  // 定位 ai 段下的 openai 段
  let openaiIdx = -1;
  if (aiIdx >= 0) {
    for (let i = aiIdx + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)(openai):\s*$/);
      if (m && m[1].length > aiIndent) {
        openaiIdx = i;
        break;
      }
    }
  }

  /**
   * 在 openai 段内替换/插入单个字段
   */
  const upsertField = (openaiIndex, openaiIndent, field, value) => {
    const indentStr = ' '.repeat(openaiIndent + 2);
    for (let i = openaiIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^(\s*)([A-Za-z0-9_]+):/);
      if (!m) {
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        break;
      }
      if (m[1].length <= openaiIndent) break; // openai 段结束
      if (m[2] === field) {
        lines[i] = indentStr + `${field}: ${yamlQuote(value)}`;
        return;
      }
    }
    // 未找到：插入到 openai 段末尾
    let insertIdx = openaiIndex + 1;
    while (insertIdx < lines.length) {
      const m = lines[insertIdx].match(/^(\s*)([A-Za-z0-9_]+):/);
      if (m && m[1].length <= openaiIndent) break;
      insertIdx++;
    }
    lines.splice(insertIdx, 0, indentStr + `${field}: ${yamlQuote(value)}`);
  };

  if (openaiIdx >= 0) {
    for (const [field, value] of Object.entries(fields)) {
      upsertField(openaiIdx, aiIndent + 2, field, value);
    }
  } else if (aiIdx >= 0) {
    // ai 段存在但无 openai 段：在 ai 段末尾追加
    let aiEndIdx = lines.length;
    for (let i = aiIdx + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)([A-Za-z0-9_.]+):/);
      if (m && m[1].length <= aiIndent) {
        aiEndIdx = i;
        break;
      }
    }
    const block = [' '.repeat(aiIndent + 2) + 'openai:'];
    for (const [field, value] of Object.entries(fields)) {
      block.push(' '.repeat(aiIndent + 4) + `${field}: ${yamlQuote(value)}`);
    }
    lines.splice(aiEndIdx, 0, ...block);
  } else {
    // 文件不存在或无 ai 段：追加完整段落
    lines.push('', 'ai:', '  openai:');
    for (const [field, value] of Object.entries(fields)) {
      lines.push('    ' + `${field}: ${yamlQuote(value)}`);
    }
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, lines.join(eol) + eol);
  return {
    ok: true,
    configPath,
    message: fileExisted ? '配置已保存' : '配置文件已创建并保存',
  };
}

module.exports = {
  getAiConfigPath,
  loadAiConfig,
  applyAiConfigToEnv,
  getLastLoadSummary,
  extractOpenAiConfig,
  readAiConfig,
  saveAiConfig,
};
