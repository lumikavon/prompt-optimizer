/**
 * 路由初始化测试 - 验证模板下拉框有选项
 *
 * 功能：
 * - 验证各个路由初始化后，提示词模板下拉框都有选项
 * - 确保数据加载正常，避免空状态
 *
 * 测试范围：
 * - Basic 模式：basic-system, basic-user
 * - Image 模式：text2image, image2image
 *
 * 说明：Pro 模式已随 UI 重构移除；优化模型/Text Model 下拉也已移除（模型统一在"优化模型配置"弹窗配置），
 * 因此这里只验证模板下拉（优化提示词模板 / 优化模板）在各工作区都有选项。
 */
import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'

type RouteCase = {
  name: string
  mode: 'basic' | 'image'
  subMode: string
  hashPath: string
  templateLabel: RegExp
}

const ROUTES: RouteCase[] = [
  {
    name: 'basic-system',
    mode: 'basic' as const,
    subMode: 'system' as const,
    hashPath: '/#/basic/system',
    templateLabel: /优化提示词模板|优化提示词|Optimization Template/i,
  },
  {
    name: 'basic-user',
    mode: 'basic' as const,
    subMode: 'user' as const,
    hashPath: '/#/basic/user',
    templateLabel: /优化提示词模板|优化提示词|Optimization Template/i,
  },
  {
    name: 'image-text2image',
    mode: 'image' as const,
    subMode: 'text2image' as const,
    hashPath: '/#/image/text2image',
    templateLabel: /优化模板|Optimization Template/i,
  },
  {
    name: 'image-image2image',
    mode: 'image' as const,
    subMode: 'image2image' as const,
    hashPath: '/#/image/image2image',
    templateLabel: /优化模板|Optimization Template/i,
  },
]

/**
 * 验证下拉框有选项
 * @description 检查 Naive UI Select 组件是否渲染了选项
 */
async function expectSelectHasOptions(page: Parameters<typeof test>[0]['page'], label: RegExp): Promise<void> {
  const labelNode = page.getByText(label).first()
  await expect(labelNode).toBeVisible({ timeout: 15000 })

  // 找到包含该 label 的最近选择器容器（Naive UI NSelect 会渲染 .n-base-selection）
  const container = labelNode.locator(
    'xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]'
  )
  const select = container.locator('.n-base-selection').first()

  await expect(select).toBeVisible({ timeout: 15000 })
  await select.click()

  // 有选项时会渲染 .n-base-select-option；空态会渲染 empty slot
  const firstOption = page.locator('.n-base-select-option').first()
  await expect(firstOption).toBeVisible({ timeout: 15000 })

  const optionCount = await page.locator('.n-base-select-option').count()
  expect(optionCount).toBeGreaterThan(0)

  await page.keyboard.press('Escape')
}

test.describe('Route Initialization: 模板下拉框有值', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ page }) => {
      // ✅ 使用 navigateToMode 导航（从 / 进入，再通过 UI 切换到目标工作区）
      await navigateToMode(page, route.mode, route.subMode)

      // ✅ 验证模板下拉框加载了选项
      await expectSelectHasOptions(page, route.templateLabel)
    })
  }
})
