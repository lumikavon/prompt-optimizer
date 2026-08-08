import { test, expect } from '../fixtures'

/**
 * Basic User 模式 - Session 持久化测试
 *
 * 测试场景：
 * 1. 优化模型选择在刷新后保留（优化模型下拉已随 UI 重构移除，
 *    模型统一在"优化模型配置"弹窗配置，这里通过 session store 直接注入后验证恢复）
 * 2. 切换模板后刷新，验证选择是否保留（通过 UI 验证）
 *
 * 注意：测试验证用户看到的 UI 状态，而不是底层存储实现
 */
test.describe('Basic User - Session Persistence', () => {
  test('优化模型选择后刷新页面，选择应该保留', async ({ page }) => {
    // 1. 导航到 basic/user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/#/basic/user')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // 等待数据加载

    // 2. 通过 session store 注入优化模型（模型下拉已从输入面板移除，见 AiConfigModal）
    const storeResult = await page.evaluate(async () => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      const store = pinia?._s?.get('basicUserSession')
      if (!store) throw new Error('basicUserSession store not found')

      const before = store.selectedOptimizeModelKey
      // 记录初始值，随后切换到不同模型再持久化
      const modelKey = before === 'deepseek' ? 'dashscope' : 'deepseek'
      store.updateOptimizeModel?.(modelKey)
      await store.saveSession?.()
      return { modelKey }
    })

    // 3. 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // 等待恢复完成

    // 4. 验证刷新后 store 中保留的是切换后的模型
    const afterRefresh = await page.evaluate(() => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      return String(pinia?.state?.value?.['basicUserSession']?.selectedOptimizeModelKey ?? '')
    })
    expect(afterRefresh).toBe(storeResult.modelKey)
  })

  test('切换模板后刷新页面，选择应该保留', async ({ page }) => {
    // 1. 导航到 basic/user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/#/basic/user')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 2. 找到模板下拉框并记录初始值
    const templateLabel = page.getByText(/优化提示词模板|优化提示词|Optimization Template/i).first()
    await expect(templateLabel).toBeVisible({ timeout: 15000 })

    const container = templateLabel.locator('xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]')
    const select = container.locator('.n-base-selection').first()

    const getSelectedTemplate = async () => {
      return await select.textContent()
    }

    const initialTemplate = await getSelectedTemplate()
    console.log(`初始模板: ${initialTemplate || '(未设置)'}`)

    // 3. 点击下拉框并切换
    await select.click()
    await page.waitForTimeout(500)

    // 获取所有选项
    const options = await page.locator('.n-base-select-option').allTextContents()
    console.log(`可用模板选项: ${options.length} 个`)
    expect(options.length).toBeGreaterThan(0)

    // 记录要切换到的模板（选择第二个选项，如果存在）
    const targetIndex = options.length > 1 ? 1 : 0
    const targetTemplate = options[targetIndex]

    if (targetIndex === 0) {
      console.log('⚠️ 只有一个模板选项，跳过切换测试')
      return
    }

    // 点击第二个选项
    await page.locator('.n-base-select-option').nth(targetIndex).click()
    console.log(`切换到模板: ${targetTemplate}`)

    // 4. 验证切换后的值已更新
    await page.waitForTimeout(500)
    const afterSwitch = await getSelectedTemplate()
    console.log(`切换后: ${afterSwitch}`)

    // 5. 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 6. 验证刷新后下拉框是否显示之前选择的值
    const afterRefresh = await getSelectedTemplate()
    console.log(`刷新后: ${afterRefresh}`)

    // 关键断言：刷新后的值应该等于切换后的值
    if (afterRefresh === targetTemplate) {
      console.log('✅ 持久化成功：模板选择已保留')
    } else {
      console.log(`❌ 持久化失败：期望 "${targetTemplate}"，实际 "${afterRefresh}"`)
    }

    // 这个断言会验证持久化是否成功
    expect(afterRefresh).toBe(targetTemplate)
  })
})
