import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readWorkspaceSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/image-mode/ImageMultiImageWorkspace.vue'),
    'utf8',
  )

describe('image multiimage workspace guards', () => {
  it('persists layout changes through the session save queue', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/watch\(\s*\(\)\s*=>\s*session\.layout,/)
    expect(source).toMatch(/queueSessionSave\(\)/)
  })

  it('registers restore listeners before onMounted and clears stale images on external restore', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/session\.replaceInputImages\(\[\]\)/)

    const restoreListenerIndex = source.indexOf("window.addEventListener('image-workspace-restore-favorite'")
    const onMountedIndex = source.indexOf('onMounted(async () => {')

    expect(restoreListenerIndex).toBeGreaterThanOrEqual(0)
    expect(onMountedIndex).toBeGreaterThanOrEqual(0)
    expect(restoreListenerIndex).toBeLessThan(onMountedIndex)
  })

  it('refreshes template and model selectors like the single-image workspace', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/handleTemplateSelectFocus/)
    expect(source).toMatch(/image-workspace-refresh-iterate-select/)
    expect(source).toMatch(/image-workspace-refresh-text-models/)
    expect(source).toMatch(/image-workspace-refresh-image-models/)
    expect(source).toMatch(/image-workspace-refresh-templates/)
  })

  it('surfaces only unsupported multi-image models in the generation area', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/multiImageUnsupported/)
    expect(source).toMatch(/shouldShowVariantModelWarning/)
    expect(source).toMatch(/isVariantModelUnsupported/)
    expect(source).not.toMatch(/multiImageSupportedShort/)
    expect(source).not.toMatch(/multiImageUnsupportedShort/)
    expect(source).not.toMatch(/multiImageSupported:\s/)
  })
})
