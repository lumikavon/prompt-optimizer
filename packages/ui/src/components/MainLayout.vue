<template>
  <!-- 使用ToastUI包装整个布局以提供NMessageProvider -->
  <ToastUI>
    <NLayout style="position: fixed; inset: 0; width: 100vw; height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    overflow: hidden; display: flex; min-height: 0;"
    content-style="height: 100%; max-height: 100%; min-height: 0; overflow: hidden;"
    >

      <div style="position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; max-height: 100vh; max-height: 100dvh; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
      <!-- 顶部窗口控制条（桌面端无边框窗口：仅窗口控制按钮，工具栏在其下方） -->
      <div
        v-if="isDesktopWindow"
        class="window-titlebar"
        @dblclick="handleHeaderDblClick"
      >
        <div class="window-titlebar-spacer"></div>
        <WindowControls />
      </div>

      <!-- 工具栏（导航栏） -->
      <NLayoutHeader class="theme-header nav-header-enhanced">
        <NFlex justify="space-between" align="center" class="w-full nav-content" :wrap="true" :size="[16, 12]">
          <!-- 左侧：Logo + 标题 + 核心导航 -->
          <NFlex align="center" :size="16" :wrap="true" class="min-w-0 flex-1">
            <!-- Logo + 标题 -->
            <NButton
              text
              class="brand-link"
              @click="openBrandWebsite"
            >
              <NFlex align="center" :size="8" :wrap="false">
                <AppPreviewImage
                  :src="logoSrc"
                  alt="Logo"
                  :width="logoSize"
                  :height="logoSize"
                  object-fit="cover"
                  class="logo-image"
                  :show-toolbar="false"
                  :preview-disabled="true"
                  :fallback-src="fallbackLogoSrc"
                />
                <NText class="text-lg sm:text-xl font-bold theme-title" tag="h2">
                  <slot name="title">{{ t('common.appName') }}</slot>
                </NText>
              </NFlex>
            </NButton>

            <!-- 核心导航元素 -->
            <div class="core-navigation">
              <slot name="core-nav"></slot>
            </div>
          </NFlex>

          <!-- 右侧：操作按钮 -->
          <NFlex align="center" :size="8" :wrap="true" justify="end" class="nav-actions">
            <slot name="actions"></slot>
          </NFlex>
        </NFlex>
      </NLayoutHeader>

      <!-- 主要内容区域 - 严格控制在剩余空间内 -->
      <NLayoutContent has-sider
        class="main-content-padding"
        style="flex: 1; min-height: 0; overflow: hidden;"
        content-style="height: 100%; max-height: 100%; min-height: 0; box-sizing: border-box; padding: var(--main-content-padding, 24px clamp(16px, 2vw, 48px) 40px); display: flex; flex-direction: column; align-items: stretch; overflow: hidden;"
      >
        <div class="main-content-wrapper">
          <slot name="main"></slot>
        </div>
      </NLayoutContent>
      </div>

      <!-- 弹窗插槽 -->
      <slot name="modals"></slot>

    </NLayout>
  </ToastUI>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NLayout, NLayoutHeader, NLayoutContent, NFlex, NText } from 'naive-ui'
import ToastUI from './Toast.vue'
import logoImage from '../assets/logo.png'
import AppPreviewImage from './media/AppPreviewImage.vue'
import WindowControls from './app-layout/WindowControls.vue'
import { openExternalUrl } from '../utils/open-external-url'

const { t } = useI18n()

// Logo图片配置
const logoSrc = logoImage

// 创建简单的SVG fallback logo
const createFallbackSvg = () => {
  const svg = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#3b82f6"/>
      <text x="16" y="21" text-anchor="middle" fill="white" font-family="system-ui" font-size="14" font-weight="bold">P</text>
    </svg>
  `)}`
  return svg
}

const fallbackLogoSrc = createFallbackSvg()

// 响应式Logo尺寸 - 使用更智能的检测
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    window.addEventListener('resize', updateWindowWidth)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth)
  }
})

const logoSize = computed(() => {
  if (windowWidth.value < 480) {
    return 20 // 超小屏幕
  } else if (windowWidth.value < 640) {
    return 24 // 小屏幕
  }
  return 28 // 默认尺寸
})

const openBrandWebsite = async () => {
  await openExternalUrl('https://always200.com', { logPrefix: 'MainLayout' })
}

// 桌面端无边框窗口检测（顶部窗口控制条仅在 Electron 桌面环境显示）
const isDesktopWindow = Boolean(
  (window as unknown as { electronAPI?: { isElectron?: boolean } })?.electronAPI?.isElectron
)

// 无边框窗口：双击窗口控制条空白区域切换最大化/还原
const handleHeaderDblClick = () => {
  const wc = (window as unknown as { electronAPI?: { windowControls?: { toggleMaximize?: () => Promise<void> } } })
    ?.electronAPI?.windowControls
  void wc?.toggleMaximize?.()
}
</script>

<style>
.main-content-wrapper {
  width: 100%;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.main-content-wrapper > * {
  flex: 1;
  min-height: 0;
}

/* 无边框窗口：顶部窗口控制条作为拖拽区域，按钮排除在外 */
.window-titlebar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 34px;
  min-height: 34px;
  flex-shrink: 0;
  padding: 0 4px 0 12px;
  -webkit-app-region: drag;
  user-select: none;
}

.window-titlebar-spacer {
  flex: 1;
  min-width: 0;
}

/* 矮窗口：压缩窗口控制条高度，让出更多垂直空间 */
@media (max-height: 560px) {
  .window-titlebar {
    height: 26px;
    min-height: 26px;
  }
}

/* 工具栏不再作为拖拽区域 */
.theme-header {
  -webkit-app-region: no-drag;
}

/* 增强导航栏样式 */
.nav-header-enhanced {
  min-height: 64px !important;
  padding: 12px 16px !important;
}

.nav-content {
  min-height: 40px;
  row-gap: 8px;
}

.nav-actions {
  min-height: 40px;
  /* 无操作按钮时仍保留最小宽度，防止窄窗下标题/导航被挤压 */
  min-width: 48px;
}

.brand-link {
  align-items: center;
  padding: 6px 10px 6px 6px;
  border-radius: 12px;
  color: inherit;
  transition:
    background-color 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out,
    transform 0.2s ease-in-out;
}

.brand-link:hover {
  background: color-mix(in srgb, var(--n-primary-color) 10%, transparent);
  transform: translateY(-1px);
}

.brand-link:hover .logo-image {
  transform: scale(1.05);
}

.brand-link:hover .theme-title {
  opacity: 0.88;
}

.brand-link:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--n-primary-color) 14%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-primary-color) 28%, transparent);
}

/* Logo样式优化 */
.logo-image {
  border-radius: 6px;
  transition: transform 0.2s ease-in-out;
  flex-shrink: 0;
}

/* 标题文字对齐优化 */
.theme-title {
  line-height: 1.2 !important;
  margin: 0 !important;
  white-space: nowrap;
  transition: opacity 0.2s ease-in-out;
}

/* 核心导航样式 */
.core-navigation {
  display: flex;
  align-items: center;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--n-border-color);
  min-height: 32px;
}

/* 主要内容区域内边距（随视口尺寸缩放） */
.main-content-padding {
  --main-content-padding: 24px clamp(16px, 2vw, 48px) 40px;
}

/* 窄窗口：减少主要内容区域的内边距，腾出更多空间给工作区 */
@media (max-width: 767px) {
  .main-content-padding {
    --main-content-padding: 16px 12px 28px;
  }

  .nav-header-enhanced {
    min-height: 56px !important;
  }
}

/* 矮窗口：降低头部与内容内边距，避免内容被裁剪 */
@media (max-height: 620px) {
  .main-content-padding {
    --main-content-padding: 12px clamp(12px, 2vw, 24px) 20px;
  }

  .nav-header-enhanced {
    padding: 8px 12px !important;
    min-height: 52px !important;
  }
}

/* 响应式优化 */
@media (max-width: 639px) {
  .logo-image {
    border-radius: 4px;
  }

  .core-navigation {
    margin-left: 8px;
    padding-left: 8px;
  }

  .nav-header-enhanced {
    padding: 10px 12px !important;
  }
}

.custom-select {
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
}

.custom-select::-ms-expand {
  display: none;
}
</style>
