import { resolve } from 'node:path'

import type { Locator, Page } from '@playwright/test'

import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'

const MULTIIMAGE_SESSION_KEY = 'pref:session/v1/image-multiimage'

// 读取 IDB 中 multiimage 会话快照（验证上传/输入已真正持久化，而非仅存在于内存）。
// 上传后的 saveSession 需要持久化图片资源，可能较慢；若在保存完成前 reload，
// 未提交的 IndexedDB 写入会被页面卸载中断，导致刷新后恢复为空（负载下偶发）。
async function readMultiImageSnapshot(page: Page) {
  return page.evaluate(async ({ key }) => {
    const dbName = (window as any).__TEST_DB_NAME__ || 'PromptOptimizerDB'
    return new Promise<any>((resolve) => {
      const open = indexedDB.open(dbName)
      open.onerror = () => resolve(null)
      open.onsuccess = () => {
        try {
          const db = open.result
          const tx = db.transaction('storage', 'readonly')
          const store = tx.objectStore('storage')
          const req = store.get(key)
          req.onerror = () => resolve(null)
          req.onsuccess = () => {
            const rec = req.result as { value?: string } | undefined
            if (!rec?.value) {
              resolve(null)
              return
            }
            try {
              resolve(JSON.parse(rec.value))
            } catch {
              resolve(null)
            }
          }
        } catch {
          resolve(null)
        }
      }
    })
  }, { key: MULTIIMAGE_SESSION_KEY })
}

async function fillMultiImagePrompt(workspace: Locator, value: string) {
  const input = workspace.getByTestId('image-multiimage-input')
  await expect(input).toBeVisible({ timeout: 30000 })

  const cmContent = input.locator('.cm-content').first()
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await workspace.page().keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await workspace.page().keyboard.type(value)
    return
  }

  await input.locator('textarea').first().fill(value)
}

async function expectMultiImagePromptValue(
  workspace: Locator,
  value: string,
) {
  const input = workspace.getByTestId('image-multiimage-input')

  await expect.poll(async () => {
    const textarea = input.locator('textarea').first()
    if ((await textarea.count()) > 0) {
      return textarea.inputValue()
    }

    const cmContent = input.locator('.cm-content').first()
    if ((await cmContent.count()) > 0) {
      if ((await cmContent.locator('.cm-placeholder').count()) > 0) {
        return ''
      }
      return (await cmContent.innerText()).trim()
    }

    return ''
  }, { timeout: 30000 }).toBe(value)
}

test.describe('Image MultiImage - Session Persistence', () => {
  // 说明：图像测试区（多列对比生成）已随 UI 重构移除，列数选择不再存在于界面中；
  // 这里只验证「提示词 + 上传图片」在刷新后保留。
  test('refresh keeps prompt and uploaded image count', async ({ page }) => {
    test.setTimeout(120000)

    await navigateToMode(page, 'image', 'multiimage')

    const workspace = page.locator('[data-mode="image-multiimage"]').first()
    await expect(workspace).toBeVisible({ timeout: 20000 })

    await fillMultiImagePrompt(workspace, '请把图1的人物放到图2的城市背景里，保持电影感')

    const fileInput = workspace.locator('input[type="file"]').first()
    await fileInput.setInputFiles([
      resolve(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png'),
      resolve(process.cwd(), 'packages/desktop/icons/app-icon.png'),
    ])

    await expect(workspace.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
    await expect(workspace.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })

    // 等待上传触发的一次性 saveSession 真正落盘（含图片资源持久化），避免 reload 中断未提交的写入
    await expect
      .poll(
        async () => {
          const snap = await readMultiImageSnapshot(page)
          return snap?.originalPrompt === '请把图1的人物放到图2的城市背景里，保持电影感' &&
            Array.isArray(snap?.inputImages) &&
            snap.inputImages.length === 2
            ? true
            : false
        },
        { timeout: 30000 },
      )
      .toBe(true)

    await page.reload()
    await page.waitForLoadState('networkidle')

    const workspaceAfter = page.locator('[data-mode="image-multiimage"]').first()
    await expect(workspaceAfter).toBeVisible({ timeout: 20000 })

    await expectMultiImagePromptValue(workspaceAfter, '请把图1的人物放到图2的城市背景里，保持电影感')
    await expect(workspaceAfter.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
    await expect(workspaceAfter.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })
  })
})
