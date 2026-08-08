import { test, expect, type Page } from '../fixtures'
import { navigateToMode, switchModeViaUI } from '../helpers/common'
import { fillOriginalPrompt, getWorkspace } from '../helpers/optimize'

const BASIC_USER_PROMPT = 'E2E diag basic user prompt'
const IMAGE_TEXT2IMAGE_PROMPT = 'E2E diag image text2image prompt must survive'

const SESSION_KEYS = [
  'pref:session/v1/basic-system',
  'pref:session/v1/basic-user',
  'pref:session/v1/image-text2image',
  'pref:session/v1/image-image2image',
  'pref:session/v1/image-multiimage',
]

async function readStore(page: Page, storeId: string) {
  return page.evaluate(({ storeId }) => {
    const app = (document.querySelector('#app') as any)?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const state = pinia?.state?.value?.[storeId]
    return state
      ? {
          originalPrompt: state.originalPrompt,
          selectedTemplateId: state.selectedTemplateId,
          selectedTextModelKey: state.selectedTextModelKey,
        }
      : null
  }, { storeId })
}

async function readIndexedDbSnapshot(page: Page, key: string) {
  return page.evaluate(async ({ key }) => {
    const dbName = (window as any).__TEST_DB_NAME__ || 'PromptOptimizerDB'
    return new Promise<any>((resolve) => {
      const open = indexedDB.open(dbName)
      open.onerror = () => resolve({ dbName, error: 'open-error', key })
      open.onsuccess = () => {
        try {
          const db = open.result
          const tx = db.transaction('storage', 'readonly')
          const store = tx.objectStore('storage')
          const req = store.get(key)
          req.onerror = () => resolve({ dbName, key, error: 'get-error' })
          req.onsuccess = () => {
            const rec = req.result as { value?: string } | undefined
            if (!rec?.value) {
              resolve({ dbName, key, hit: null })
              return
            }
            let parsed: any = null
            try {
              parsed = JSON.parse(rec.value)
            } catch {
              parsed = null
            }
            resolve({
              dbName,
              key,
              hit: true,
              originalPrompt: parsed?.originalPrompt ?? '<missing>',
              selectedTemplateId: parsed?.selectedTemplateId ?? '<missing>',
              selectedTextModelKey: parsed?.selectedTextModelKey ?? '<missing>',
            })
          }
        } catch (e) {
          resolve({ dbName, key, error: String(e) })
        }
      }
    })
  }, { key })
}

async function readAllSessionSnapshots(page: Page) {
  const out: Record<string, any> = {}
  for (const key of SESSION_KEYS) {
    out[key] = await readIndexedDbSnapshot(page, key)
  }
  return out
}

async function instrumentSaveCalls(page: Page) {
  return page.evaluate(() => {
    const app = (document.querySelector('#app') as any)?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const store = pinia?._s?.get('imageText2ImageSession')
    if (!store) return { ok: false, reason: 'store not found' }
    const win = window as any
    win.__saveCalls = []
    const original = store.saveSession.bind(store)
    store.saveSession = async (...args: any[]) => {
      win.__saveCalls.push({
        at: Date.now(),
        prompt: store.originalPrompt,
        templateId: store.selectedTemplateId,
      })
      const r = await original(...args)
      return r
    }
    return { ok: true }
  }, {})
}

async function instrumentSwitchManager(page: Page) {
  return page.evaluate(() => {
    const app = (document.querySelector('#app') as any)?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const mgr = pinia?._s?.get('sessionManager')
    if (!mgr) return { ok: false, reason: 'sessionManager not found' }
    const win = window as any
    win.__switchCalls = []
    const origSwitchMode = mgr.switchMode.bind(mgr)
    const origSwitchSubMode = mgr.switchSubMode.bind(mgr)
    const origGetActive = mgr.getActiveSubModeKey.bind(mgr)
    mgr.switchMode = async (fromKey: string, toKey: string) => {
      win.__switchCalls.push({ type: 'switchMode', fromKey, toKey, activeNow: origGetActive() })
      return origSwitchMode(fromKey, toKey)
    }
    mgr.switchSubMode = async (fromKey: string, toKey: string) => {
      win.__switchCalls.push({ type: 'switchSubMode', fromKey, toKey, activeNow: origGetActive() })
      return origSwitchSubMode(fromKey, toKey)
    }
    return { ok: true, activeNow: origGetActive() }
  }, {})
}

async function readSwitchCalls(page: Page) {
  return page.evaluate(() => (window as any).__switchCalls ?? null)
}

async function readSaveCalls(page: Page) {
  return page.evaluate(() => (window as any).__saveCalls ?? null)
}

async function readDomPrompt(page: Page, mode: string) {
  const workspace = getWorkspace(page, mode as any)
  const input = workspace.locator(`[data-testid="${mode}-input"]`)
  if ((await input.count()) === 0) return '<no input>'
  const textarea = input.locator('textarea').first()
  if ((await textarea.count()) > 0) {
    return await textarea.inputValue()
  }
  const cmContent = input.locator('.cm-content').first()
  if ((await cmContent.count()) > 0) {
    if ((await cmContent.locator('.cm-placeholder').count()) > 0) return ''
    return (await cmContent.innerText()).trim()
  }
  return '<no cm/textarea>'
}

test('diag: image prompt persistence across switch + reload', async ({ page }) => {
  test.setTimeout(180000)
  page.on('console', (msg) => {
    const text = msg.text()
    if (
      /diag-|\[SessionManager\]|\[ImageText2ImageSession\]|\[PromptOptimizerApp\]|\[PreferenceService\]|\[useWorkspaceTextModelSelection\]|\[useWorkspaceTemplateSelection\]|Dexie|indexedDB|refreshTextModels|restoreSession|switchSubMode|switchMode/.test(
        text,
      )
    ) {
      console.log('[page-console]', text.slice(0, 400))
    }
  })

  await navigateToMode(page, 'basic', 'user')
  await fillOriginalPrompt(page, 'basic-user', BASIC_USER_PROMPT)

  await switchModeViaUI(page, 'image', 'text2image')
  await expect(getWorkspace(page, 'image-text2image')).toBeVisible({ timeout: 20000 })

  console.log(
    '[diag:0] after switch-to-image: store=',
    JSON.stringify(await readStore(page, 'imageText2ImageSession')),
  )
  console.log('[diag:0] switchCalls=', JSON.stringify(await readSwitchCalls(page)))
  console.log(
    '[diag:0] idb=',
    JSON.stringify(await readIndexedDbSnapshot(page, 'pref:session/v1/image-text2image')),
  )

  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(300)
    const st = await readStore(page, 'imageText2ImageSession')
    console.log(
      `[diag:0.${i}] store=`,
      JSON.stringify({
        model: st?.selectedTextModelKey,
        template: st?.selectedTemplateId,
        prompt: st?.originalPrompt,
      }),
    )
  }
  await fillOriginalPrompt(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)

  console.log('[diag:instr] saveInit=', JSON.stringify(await instrumentSaveCalls(page)))
  console.log('[diag:instr] mgrInit=', JSON.stringify(await instrumentSwitchManager(page)))

  console.log(
    '[diag:1] store=',
    JSON.stringify(await readStore(page, 'imageText2ImageSession')),
  )
  console.log('[diag:1] saveCalls=', JSON.stringify(await readSaveCalls(page)))
  console.log('[diag:1] switchCalls=', JSON.stringify(await readSwitchCalls(page)))
  console.log('[diag:1] dom=', JSON.stringify(await readDomPrompt(page, 'image-text2image')))
  console.log('[diag:1] idb=', JSON.stringify(await readAllSessionSnapshots(page)))

  await switchModeViaUI(page, 'basic', 'user')
  await expect(getWorkspace(page, 'basic-user')).toBeVisible({ timeout: 20000 })

  console.log(
    '[diag:2] after switch-away: store=',
    JSON.stringify(await readStore(page, 'imageText2ImageSession')),
  )
  console.log('[diag:2] saveCalls=', JSON.stringify(await readSaveCalls(page)))
  console.log('[diag:2] switchCalls=', JSON.stringify(await readSwitchCalls(page)))
  console.log('[diag:2] idb=', JSON.stringify(await readAllSessionSnapshots(page)))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(getWorkspace(page, 'basic-user')).toBeVisible({ timeout: 20000 })

  console.log(
    '[diag:3] after reload: store=',
    JSON.stringify(await readStore(page, 'imageText2ImageSession')),
  )
  console.log('[diag:3] saveCalls=', JSON.stringify(await readSaveCalls(page)))
  console.log('[diag:3] idb=', JSON.stringify(await readAllSessionSnapshots(page)))

  await switchModeViaUI(page, 'image', 'text2image')
  await expect(getWorkspace(page, 'image-text2image')).toBeVisible({ timeout: 20000 })

  console.log(
    '[diag:4] after switch-back: store=',
    JSON.stringify(await readStore(page, 'imageText2ImageSession')),
  )
  console.log('[diag:4] dom=', JSON.stringify(await readDomPrompt(page, 'image-text2image')))
  console.log('[diag:4] idb=', JSON.stringify(await readAllSessionSnapshots(page)))

  const finalStore = await readStore(page, 'imageText2ImageSession')
  console.log('[diag:FINAL] store.originalPrompt=', JSON.stringify(finalStore?.originalPrompt))
})
