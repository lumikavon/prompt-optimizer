import { expect, type Page } from '@playwright/test'

const IMAGE_SESSION_STORE_IDS: Record<string, string> = {
  'image-text2image': 'imageText2ImageSession',
  'image-image2image': 'imageImage2ImageSession',
  'image-multiimage': 'imageMultiImageSession',
}

/**
 * 通过 Pinia session store 直接设置工作区的文本模型（不依赖已被移除的模型下拉 UI）。
 * 与 workspace-clear-content.spec 中的 store seeding 方式一致。
 * 调用方需确保目标工作区已挂载（store 已注册）。
 */
export async function seedTextModelKey(
  page: Page,
  mode: 'image-text2image' | 'image-image2image' | 'image-multiimage',
  modelKey: string,
): Promise<void> {
  const storeId = IMAGE_SESSION_STORE_IDS[mode]
  if (!storeId) throw new Error(`seedTextModelKey: unsupported mode ${mode}`)

  await page.evaluate(
    async ({ storeId, modelKey }) => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      const store = pinia?._s?.get(storeId)
      if (!store) throw new Error(`seedTextModelKey: store not found: ${storeId}`)
      store.updateTextModel?.(modelKey)
      await store.saveSession?.()
    },
    { storeId, modelKey },
  )
}

/**
 * 读取 Pinia 中 image session store 的 selectedTextModelKey（用于验证持久化恢复）。
 */
export async function readSelectedTextModelKey(
  page: Page,
  mode: 'image-text2image' | 'image-image2image' | 'image-multiimage',
): Promise<string> {
  const storeId = IMAGE_SESSION_STORE_IDS[mode]
  return page.evaluate(({ storeId }) => {
    const app = (document.querySelector('#app') as any)?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    return String(pinia?.state?.value?.[storeId]?.selectedTextModelKey ?? '')
  }, { storeId })
}

/**
 * 等待应用加载完成
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('#app, [id="app"], main')).toBeAttached()
}

/**
 * 导航到指定模式
 * @description 先访问根路径等待应用初始化，再导航到目标路由
 */
export async function navigateToMode(
  page: Page,
  mode: 'basic' | 'pro' | 'image',
  subMode: string
): Promise<void> {
  // 模拟真实用户：从 / 进入，由 RootBootstrapRoute 决定初始工作区，
  // 然后通过顶部 CoreNav 切换到目标模式/子模式。
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForAppReady(page)

  // RootBootstrapRoute 会把 / 重定向到某个 workspace；等到 workspace 出现即可。
  await expect(page.locator('[data-testid="workspace"]').first()).toBeVisible({ timeout: 20000 })

  await switchModeViaUI(page, mode, subMode)

  // ✅ 验证 URL 正确
  await expect(page).toHaveURL(new RegExp(`\\/#\\/${mode}\\/${subMode}$`), { timeout: 20000 })
}

export async function switchModeViaUI(
  page: Page,
  mode: 'basic' | 'pro' | 'image',
  subMode: string
): Promise<void> {
  // 功能模式（basic/pro/image）
  const functionModeSelector = page.getByTestId('function-mode-selector')
  await expect(functionModeSelector).toBeVisible({ timeout: 20000 })

  // 不依赖按钮文案（i18n 会变），直接按 data-testid 点击
  await functionModeSelector.getByTestId(`function-mode-${mode}`).click()

  // 子模式（basic: system/user, pro: multi/variable, image: text2image/image2image）
  // image 子模式使用按钮组，不是 radio-group；分别处理。
  if (mode === 'image') {
    const coreNav = page.getByTestId('core-nav')
    const idMap: Record<string, string> = {
      text2image: 'image-sub-mode-text2image',
      image2image: 'image-sub-mode-image2image',
      multiimage: 'image-sub-mode-multiimage',
    }
    const id = idMap[subMode]
    if (!id) {
      throw new Error(`Unsupported image sub mode for e2e navigation: ${subMode}`)
    }
    await coreNav.getByTestId(id).click()
    return
  }

  const subModeSelector = page.getByTestId('optimization-mode-selector')
  await expect(subModeSelector).toBeVisible({ timeout: 20000 })

  // 不依赖按钮文案（i18n 会变），直接按 data-testid 点击
  await subModeSelector.getByTestId(`sub-mode-${subMode}`).click()
}
