import { test, expect } from '../fixtures'
import { navigateToMode, seedTextModelKey } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as path from 'path'

const MODE = 'image-image2image' as const

// 说明：图像测试区（多列对比生成）已随 UI 重构移除，
// 当前图生图工作区只保留「上传输入图 → 优化 → 右侧面板展示优化结果」流程，这里对齐该现状。
test.describe('Image Image2Image - 提示词优化流程', () => {
  test('上传输入图后优化提示词并展示结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'image', 'image2image')

    // 1) 打开上传弹窗并上传输入图
    await page.getByTestId('image-image2image-open-upload').click()

    const upload = page.getByTestId('image-image2image-upload')
    const fileInput = upload.locator('input[type="file"]')

    const seedPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')
    await fileInput.setInputFiles(seedPath)

    // 等待缩略图出现，说明 session 已注入 inputImage
    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })

    // 关闭 modal：不强依赖具体 DOM 结构，尽量退回到主界面继续
    await page.keyboard.press('Escape').catch(() => {})

    // 等待上传弹窗彻底关闭，避免残留遮罩层/动画拦截后续点击
    await expect(page.getByTestId('image-image2image-upload-modal')).toBeHidden({ timeout: 20000 })

    // 2) 固定文本模型（用于优化），避免不同环境默认模型不同导致 VCR requestHash 不稳定。
    //    模型下拉已从输入面板移除（统一在"优化模型配置"弹窗配置），这里直接 seed session store。
    //    该 VCR fixture 录制时文本优化走 dashscope qwen3.5-27b。
    await seedTextModelKey(page, MODE, 'dashscope')

    // 3) 填写提示词并优化（上传图 + 修改意图 → 右侧 PromptPanel 展示优化后的 Image-to-Image 提示词）
    await fillOriginalPrompt(page, MODE, 'make it watercolor style')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)
  })
})
