import { resolve } from 'node:path'

import { test, expect, type Page } from '../fixtures'
import { navigateToMode, switchModeViaUI } from '../helpers/common'
import {
  fillOriginalPrompt,
  getWorkspace,
  type OptimizeWorkspaceMode,
} from '../helpers/optimize'

const BASIC_USER_PROMPT = 'E2E clear content should remove only basic user prompt'
const IMAGE_TEXT2IMAGE_PROMPT = 'E2E image text2image prompt must survive basic user clear'

type ClearableWorkspaceMode = OptimizeWorkspaceMode | 'image-multiimage'

type WorkspaceRoute = {
  mode: 'basic' | 'image'
  subMode: string
  workspaceMode: ClearableWorkspaceMode
}

type WorkspaceClearCase = WorkspaceRoute & {
  name: string
  seed: (page: Page) => Promise<void>
  expectSeeded: (page: Page) => Promise<void>
  expectCleared: (page: Page) => Promise<void>
}

const IMAGE_FIXTURE = resolve(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')
const SECOND_IMAGE_FIXTURE = resolve(process.cwd(), 'packages/desktop/icons/app-icon.png')

async function getOriginalPromptEditor(page: Page, mode: ClearableWorkspaceMode) {
  const workspace = getWorkspace(page, mode)
  await expect(workspace).toBeVisible({ timeout: 20000 })

  const input = workspace.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 20000 })

  return input
}

async function readOriginalPromptValue(page: Page, mode: ClearableWorkspaceMode): Promise<string> {
  const input = await getOriginalPromptEditor(page, mode)
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
}

async function expectOriginalPromptValue(page: Page, mode: ClearableWorkspaceMode, value: string) {
  await expect.poll(async () => readOriginalPromptValue(page, mode), { timeout: 20000 }).toBe(value)
}

async function clearWorkspaceContent(page: Page, mode: ClearableWorkspaceMode) {
  await page.getByTestId(`${mode}-workspace-utility-menu`).click()

  const clearOption = page.locator('.n-dropdown-option').filter({
    hasText: /清理内容|Clear Content|清理內容/i,
  })
  await expect(clearOption).toBeVisible({ timeout: 10000 })
  await clearOption.click()

  const dialog = page.locator('.n-dialog').filter({
    hasText: /清理内容|Clear Content|清理內容/i,
  }).last()
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await expect(dialog).toContainText(/提示词、派生结果、测试结果、临时变量|prompts, derived results, test (results|outputs), temporary variables/i)
  await expect(dialog).toContainText(/模型、模板、布局选择|model, template, (and )?layout selections/i)

  await dialog.getByRole('button', { name: /确认|Confirm|確定/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10000 })
}

async function switchToWorkspace(
  page: Page,
  mode: 'basic' | 'image',
  subMode: string,
  workspaceMode: ClearableWorkspaceMode,
) {
  await switchModeViaUI(page, mode, subMode)
  await expect(getWorkspace(page, workspaceMode)).toBeVisible({ timeout: 20000 })
}

async function navigateToWorkspace(page: Page, route: WorkspaceRoute) {
  await navigateToMode(page, route.mode, route.subMode)
  await expect(getWorkspace(page, route.workspaceMode)).toBeVisible({ timeout: 20000 })
}

async function fillPrompt(page: Page, mode: Exclude<OptimizeWorkspaceMode, 'pro-multi'>, value: string) {
  await fillOriginalPrompt(page, mode, value)
}

async function fillPromptWithoutWaitingForActions(page: Page, mode: ClearableWorkspaceMode, value: string) {
  const input = await getOriginalPromptEditor(page, mode)
  const cmContent = input.locator('.cm-content').first()
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
    return
  }

  const textarea = input.locator('textarea').first()
  await expect(textarea).toBeVisible({ timeout: 20000 })
  await textarea.fill(value)
}

async function seedImageImage2Image(page: Page) {
  await page.getByTestId('image-image2image-open-upload').click()
  await page.getByTestId('image-image2image-upload').locator('input[type="file"]').setInputFiles(IMAGE_FIXTURE)
  await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('image-image2image-upload-modal')).toBeHidden({ timeout: 20000 })
  await fillPromptWithoutWaitingForActions(page, 'image-image2image', 'E2E clear image2image prompt')
}

async function seedImageMultiImage(page: Page) {
  const workspace = getWorkspace(page, 'image-multiimage')
  await expect(workspace).toBeVisible({ timeout: 20000 })

  await fillPromptWithoutWaitingForActions(page, 'image-multiimage', 'E2E clear multiimage prompt')
  await workspace.locator('input[type="file"]').first().setInputFiles([IMAGE_FIXTURE, SECOND_IMAGE_FIXTURE])

  await expect(workspace.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
  await expect(workspace.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })
}

// 说明：Pro 模式（pro-multi / pro-variable）已随 UI 重构移除；测试区（test deck）也已移除，
// 因此这里只验证各现存工作区的「提示词 + 上传图」内容在清理后清空并持久化。
const CLEAR_CASES: WorkspaceClearCase[] = [
  {
    name: 'basic-system',
    mode: 'basic',
    subMode: 'system',
    workspaceMode: 'basic-system',
    seed: (page) => fillPrompt(page, 'basic-system', 'E2E clear basic system prompt'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'basic-system', 'E2E clear basic system prompt'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'basic-system', ''),
  },
  {
    name: 'basic-user',
    mode: 'basic',
    subMode: 'user',
    workspaceMode: 'basic-user',
    seed: (page) => fillPrompt(page, 'basic-user', 'E2E clear basic user prompt'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'basic-user', 'E2E clear basic user prompt'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'basic-user', ''),
  },
  {
    name: 'image-text2image',
    mode: 'image',
    subMode: 'text2image',
    workspaceMode: 'image-text2image',
    seed: (page) => fillPrompt(page, 'image-text2image', 'E2E clear text2image prompt'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'image-text2image', 'E2E clear text2image prompt'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'image-text2image', ''),
  },
  {
    name: 'image-image2image',
    mode: 'image',
    subMode: 'image2image',
    workspaceMode: 'image-image2image',
    seed: seedImageImage2Image,
    expectSeeded: async (page) => {
      await expectOriginalPromptValue(page, 'image-image2image', 'E2E clear image2image prompt')
      await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })
    },
    expectCleared: async (page) => {
      await expectOriginalPromptValue(page, 'image-image2image', '')
      await expect(page.getByTestId('image-image2image-input-preview')).toHaveCount(0)
    },
  },
  {
    name: 'image-multiimage',
    mode: 'image',
    subMode: 'multiimage',
    workspaceMode: 'image-multiimage',
    seed: seedImageMultiImage,
    expectSeeded: async (page) => {
      await expectOriginalPromptValue(page, 'image-multiimage', 'E2E clear multiimage prompt')
      const workspace = getWorkspace(page, 'image-multiimage')
      await expect(workspace.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
      await expect(workspace.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })
    },
    expectCleared: async (page) => {
      await expectOriginalPromptValue(page, 'image-multiimage', '')
      const workspace = getWorkspace(page, 'image-multiimage')
      await expect(workspace.getByTestId('image-multiimage-card-1')).toHaveCount(0)
      await expect(workspace.getByTestId('image-multiimage-card-2')).toHaveCount(0)
    },
  },
]

test.describe('Workspace clear content', () => {
  test.describe.configure({ timeout: 60000 })

  for (const c of CLEAR_CASES) {
    test(`${c.name}: clear content only clears content and persists after reload`, async ({ page }) => {
      await navigateToWorkspace(page, c)

      await c.seed(page)
      await c.expectSeeded(page)

      await clearWorkspaceContent(page, c.workspaceMode)
      await c.expectCleared(page)

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(getWorkspace(page, c.workspaceMode)).toBeVisible({ timeout: 20000 })
      await c.expectCleared(page)
    })
  }

  test('clears only the active workspace content and persists after reload', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')
    await fillOriginalPrompt(page, 'basic-user', BASIC_USER_PROMPT)
    await expectOriginalPromptValue(page, 'basic-user', BASIC_USER_PROMPT)

    // Switching workspaces saves the previous session through the same path real users exercise.
    await switchToWorkspace(page, 'image', 'text2image', 'image-text2image')
    await fillOriginalPrompt(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)
    await expectOriginalPromptValue(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)

    await switchToWorkspace(page, 'basic', 'user', 'basic-user')
    await expectOriginalPromptValue(page, 'basic-user', BASIC_USER_PROMPT)

    await clearWorkspaceContent(page, 'basic-user')
    await expectOriginalPromptValue(page, 'basic-user', '')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(getWorkspace(page, 'basic-user')).toBeVisible({ timeout: 20000 })
    await expectOriginalPromptValue(page, 'basic-user', '')

    await switchToWorkspace(page, 'image', 'text2image', 'image-text2image')
    await expectOriginalPromptValue(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)
  })
})
