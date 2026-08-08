import { test } from '../fixtures'
import { navigateToMode, seedTextModelKey } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'

const MODE = 'image-text2image' as const

// 说明：图像测试区（多列对比生成）已随 UI 重构移除，
// 当前文生图工作区只保留「输入 → 优化 → 右侧面板展示优化结果」流程，这里对齐该现状。
test.describe('Image Text2Image - 提示词优化流程', () => {
  test('输入提示词后优化并在右侧面板展示结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'image', 'text2image')

    // 1) 固定文本模型（用于优化），避免不同环境默认模型不同导致 VCR requestHash 不稳定。
    //    模型下拉已从输入面板移除（统一在"优化模型配置"弹窗配置），这里直接 seed session store。
    await seedTextModelKey(page, MODE, 'deepseek')

    // 2) 输入提示词并优化（左侧输入 → 右侧 PromptPanel 展示优化结果）
    //    尽量保持 prompt 简短，避免生成的优化 prompt 过长。
    await fillOriginalPrompt(page, MODE, 'corgi, studio photo')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)
  })
})
