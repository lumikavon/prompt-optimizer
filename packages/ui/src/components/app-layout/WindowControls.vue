<template>
    <div v-if="isDesktop" class="window-controls">
        <button
            type="button"
            class="window-control-btn"
            :title="t('windowControls.minimize')"
            aria-label="Minimize"
            @click="handleMinimize"
        >
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M0 5h10" stroke="currentColor" stroke-width="1.2" />
            </svg>
        </button>
        <button
            type="button"
            class="window-control-btn"
            :title="isMaximized ? t('windowControls.restore') : t('windowControls.maximize')"
            :aria-label="isMaximized ? 'Restore' : 'Maximize'"
            @click="handleToggleMaximize"
        >
            <svg
                v-if="isMaximized"
                viewBox="0 0 10 10"
                width="10"
                height="10"
                aria-hidden="true"
            >
                <path
                    d="M2.5 2.5v-2h6v6h-2M0.5 4.5h6v-4" fill="none"
                    stroke="currentColor" stroke-width="1.1"
                />
                <path d="M2.5 2.5h-2v6h6v-2" fill="none" stroke="currentColor" stroke-width="1.1" />
            </svg>
            <svg v-else viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M1 1h8v8H1z" fill="none" stroke="currentColor" stroke-width="1.1" />
            </svg>
        </button>
        <button
            type="button"
            class="window-control-btn window-control-btn--close"
            :title="t('windowControls.close')"
            aria-label="Close"
            @click="handleClose"
        >
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.2" />
            </svg>
        </button>
    </div>
</template>

<script setup lang="ts">
/**
 * WindowControls - 桌面端无边框窗口控制按钮
 *
 * 在 Electron 桌面环境中显示 最小化 / 最大化(还原) / 关闭 三个按钮，
 * 通过 preload 暴露的 window.electronAPI.windowControls 与主进程通信。
 * Web 环境不渲染任何内容。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface WindowControlAPI {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
}

interface ElectronAPI {
    isElectron?: boolean
    windowControls?: WindowControlAPI
}

const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
const isDesktop = Boolean(electronAPI?.isElectron && electronAPI?.windowControls)

const isMaximized = ref(false)

const handleMinimize = () => {
    void electronAPI?.windowControls?.minimize()
}

const handleToggleMaximize = () => {
    void electronAPI?.windowControls?.toggleMaximize()
}

const handleClose = () => {
    void electronAPI?.windowControls?.close()
}

let unsubscribeMaximized: (() => void) | null = null

onMounted(async () => {
    if (!isDesktop) return
    try {
        isMaximized.value = await electronAPI!.windowControls!.isMaximized()
    } catch {
        // 忽略：主进程未就绪时保持默认状态
    }
    unsubscribeMaximized = electronAPI!.windowControls!.onMaximizedChange((maximized) => {
        isMaximized.value = maximized
    })
})

onBeforeUnmount(() => {
    unsubscribeMaximized?.()
    unsubscribeMaximized = null
})
</script>

<style scoped>
.window-controls {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    border-left: 1px solid var(--n-border-color);
    padding-left: 4px;
}

.window-control-btn {
    width: 34px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--n-text-color-2);
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    -webkit-app-region: no-drag;
}

.window-control-btn:hover {
    background: color-mix(in srgb, var(--n-text-color) 12%, transparent);
    color: var(--n-text-color);
}

.window-control-btn--close:hover {
    background: #e81123;
    color: #ffffff;
}
</style>
