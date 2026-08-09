# 图像模式（Image Mode）

> **当前状态（v2.12.0）**：图像模式聚焦「提示词优化」——在文生图/图生图/多图工作区中组合提示词（可附带本地参考图）、定义变量、选择模板，然后进行分析、优化与评估。多列测试区与图像生成输出界面已随 v2.12.0 的 UI 重构移除；核心层的图像模型适配器与 `ImageService` 仍保留，供后续能力恢复或桌面端直接调用。

## 功能范围
- 文生图（T2I）：仅文本提示词
- 图生图（I2I）：单张本地参考图 + 文本提示词（仅 png/jpeg，≤10MB）
- 多图（Multi-Image）：多张输入图共同约束主体关系、顺序语义与生成目标
- 参考图动作：复制 / 风格学习等（I2I 工作区）
- 暂不支持：图像生成输出、多列测试区、组图、mask/局部编辑、upscale、图像模板

## 内置图像模型与环境变量
- Gemini（image-gemini）
  - provider: `gemini`
  - defaultModel: `gemini-2.5-flash-image-preview`
  - apiKey: 复用 `VITE_GEMINI_API_KEY`
- Seedream（image-seedream）
  - provider: `seedream`
  - defaultModel: `doubao-seedream-4-0-250828`
  - apiKey: 读取 `VITE_SEEDREAM_API_KEY` | `VITE_ARK_API_KEY`（或 `process.env.ARK_API_KEY`）
- Seedream 5.0 Lite（image-seedream-50-lite）
  - provider: `seedream`
  - defaultModel: `doubao-seedream-5-0-260128`
  - apiKey: 复用 `VITE_SEEDREAM_API_KEY` | `VITE_ARK_API_KEY`（或 `process.env.ARK_API_KEY`）

> 提示：配置好以上环境变量后，内置图像模型将自动注入并按需启用，可在图像模型管理器中查看与编辑。

## 使用方法（Web）
1. 顶部导航进入「图像模式」，选择文生图 / 图生图 / 多图工作区。
2. 左侧输入提示词；图生图/多图可附加本地参考图片（仅 `image/png` 或 `image/jpeg`，≤10MB）。
3. 定义变量（可选）、选择提示词模板与优化模型。
4. 点击「分析」或「优化」，优化结果在右侧面板展示；可继续迭代、评估与基于评估结果改写。

## 模型管理
- 模型管理器提供图像模型页：新增、编辑、启用/禁用、删除。
- 图像模型页当前暂不提供连通性测试（后续可考虑快速小图验证）。

## 开发说明
- 核心层：`ImageService` + 适配器（Gemini/Seedream/OpenAI），适配器注册表按 provider 路由。
- UI：`ImageText2ImageWorkspace.vue` / `ImageImage2ImageWorkspace.vue` / `ImageMultiImageWorkspace.vue` 为图像模式工作区；`useImageGeneration` 封装对 `ImageService` 的调用（当前 UI 未暴露生成入口）。
- 代理与网络：现在仅支持直接访问模型提供商，如在浏览器环境遇到跨域限制，请改用桌面版或自行配置反向代理。
