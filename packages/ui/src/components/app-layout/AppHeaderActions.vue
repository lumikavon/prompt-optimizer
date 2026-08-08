<template>
    <!--
        App 头部操作按钮组件

        职责:
        - 核心功能按钮: 模板管理、历史记录
        - 辅助功能: 主题切换、语言切换

        设计说明:
        - 从 App.vue 的 #actions slot 提取出来
        - 所有操作通过 emits 通知父组件处理
        - 收藏夹、数据管理、变量管理、模型管理功能已删除
    -->
    <!-- 弹窗型管理/配置入口 -->
    <div class="modal-action-group" data-testid="header-modal-actions">
        <ActionButtonUI
            icon="📝"
            :text="$t('nav.templates')"
            @click="emit('open-templates')"
            type="default"
            size="medium"
            :ghost="false"
            :round="true"
        />
        <ActionButtonUI
            icon="📜"
            :text="$t('nav.history')"
            @click="emit('open-history')"
            type="default"
            size="medium"
            :ghost="false"
            :round="true"
        />
        <ActionButtonUI
            v-if="isDesktop"
            icon="⚙️"
            :text="$t('common.modelConfig')"
            @click="showAiConfigModal = true"
            type="default"
            size="medium"
            :ghost="false"
            :round="true"
        />
    </div>
    <!-- 辅助功能区 - 使用简化样式降低视觉权重 -->
    <ThemeToggleUI />
    <div class="aux-icon-group">
        <LanguageSwitchDropdown />
    </div>

    <!-- 优化模型配置弹窗（桌面端） -->
    <AiConfigModal v-if="isDesktop" v-model="showAiConfigModal" />
</template>

<script setup lang="ts">
/**
 * App 头部操作按钮组件
 *
 * @description
 * 从 App.vue 提取出的头部操作按钮组件，用于 MainLayoutUI 的 #actions slot。
 * 包含核心功能按钮和辅助功能按钮两部分。
 *
 * @features
 * - 核心功能: 模板管理、历史记录
 * - 辅助功能: 主题切换、语言切换
 * - 所有操作通过 emits 通知父组件
 *
 * @example
 * ```vue
 * <template #actions>
 *   <AppHeaderActions
 *     @open-templates="openTemplateManager"
 *     @open-history="historyManager.showHistory = true"
 *   />
 * </template>
 * ```
 */

import ActionButtonUI from '../ActionButton.vue'
import ThemeToggleUI from '../ThemeToggleUI.vue'
import LanguageSwitchDropdown from '../LanguageSwitchDropdown.vue'
import AiConfigModal from '../AiConfigModal.vue'
import { ref } from 'vue'

const emit = defineEmits<{
    /** 打开模板管理器 */
    'open-templates': []
    /** 打开历史记录 */
    'open-history': []
}>()

// 仅 Electron 桌面端显示"模型配置"入口
const isDesktop = Boolean(
    (window as unknown as { electronAPI?: { aiConfig?: unknown } })?.electronAPI?.aiConfig
)
const showAiConfigModal = ref(false)
</script>

<style scoped>
/* 辅助功能图标按钮 */
.aux-icon-group {
    display: inline-flex;
    align-items: center;
    gap: 2px;
}

/* 弹窗型管理入口分组 */
.modal-action-group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
</style>
