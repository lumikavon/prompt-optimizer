<template>
    <!--
        App 核心导航组件

        职责:
        - 功能模式选择器 (Basic / Pro / Image)
        - 各模式的子模式选择器

        🔧 路由架构：直接使用 router.push 进行导航
        - 从路由参数计算当前模式
        - 导航操作直接调用 router.push
    -->
    <NSpace :size="12" align="center" data-testid="core-nav">
        <!-- 功能模式选择器 -->
        <FunctionModeSelector
            :modelValue="functionMode"
            :allow-reselect="allowWorkspaceReselect"
            @change="handleFunctionModeChange"
        />

        <!-- 子模式选择器 - 基础模式 -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'basic'"
            :modelValue="basicSubMode"
            :allow-reselect="allowWorkspaceReselect"
            @change="handleBasicSubModeChange"
        />

        <!-- 子模式选择器 - 图像模式 -->
        <ImageModeSelector
            v-if="functionMode === 'image'"
            :modelValue="imageSubMode"
            :allow-reselect="allowWorkspaceReselect"
            @change="handleImageSubModeChange"
        />
    </NSpace>
</template>

<script setup lang="ts">
/**
 * App 核心导航组件
 *
 * @description
 * 用于 MainLayoutUI 的 #core-nav slot。
 * 包含功能模式选择器和各模式的子模式选择器。
 *
 * @features
 * - 功能模式切换: Basic / Image
 * - 基础模式子模式: system / user
 * - 图像模式子模式: text2image / image2image / multiimage
 *
 * 🔧 路由架构：直接使用 router.push 进行导航
 */
import { computed } from 'vue'
import { router as routerInstance } from '../../router'
import { NSpace } from 'naive-ui'
import FunctionModeSelector from '../FunctionModeSelector.vue'
import OptimizationModeSelectorUI from '../OptimizationModeSelector.vue'
import ImageModeSelector from '../image-mode/ImageModeSelector.vue'
import type { BasicSubMode, ImageSubMode } from '@prompt-optimizer/core'

// 功能模式：已删除上下文模式（Pro），仅保留基础与图像模式
type FunctionMode = 'basic' | 'image'
type SubMode = BasicSubMode

interface Props {
    workspacePath?: string
    allowWorkspaceReselect?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    allowWorkspaceReselect: false,
})

// ========================
// Router（使用 router 单例，避免注入失败/多实例）
// ========================
const activeWorkspacePath = computed(() => props.workspacePath || routerInstance.currentRoute.value.path)

// 从当前路由计算模式
const functionMode = computed<FunctionMode>(() => {
    const path = activeWorkspacePath.value
    if (path.startsWith('/basic')) return 'basic'
    if (path.startsWith('/image')) return 'image'
    return 'basic' // 默认
})

const basicSubMode = computed<BasicSubMode>(() => {
    const rawSubMode = activeWorkspacePath.value.split('/')[2]

    // ✅ 静态路由映射：system 或 user
    if (rawSubMode === 'system' || rawSubMode === 'user') {
        return rawSubMode as BasicSubMode
    }

    return 'system' // 默认值
})

const imageSubMode = computed<ImageSubMode>(() => {
    const rawSubMode = activeWorkspacePath.value.split('/')[2]

    // ✅ 静态路由映射：text2image / image2image / multiimage
    if (rawSubMode === 'text2image' || rawSubMode === 'image2image' || rawSubMode === 'multiimage') {
        return rawSubMode as ImageSubMode
    }

    return 'text2image' // 默认值
})

// ========================
// 导航处理
// ========================
// 🔧 各模式的默认子模式（避免跨模式污染）
const DEFAULT_SUB_MODES = {
    basic: 'system',
    image: 'text2image'
} as const

const navigateToWorkspacePath = (path: string) => {
    if (routerInstance.currentRoute.value.path === path) return
    routerInstance.push(path)
}

const handleFunctionModeChange = (mode: FunctionMode) => {
    if (mode === functionMode.value) {
        navigateToWorkspacePath(activeWorkspacePath.value)
        return
    }

    // 切换 functionMode 时使用默认 subMode，避免跨模式污染
    // 例如：从 /image/text2image 切到 pro，不应使用 text2image（非法）
    const defaultSubMode = DEFAULT_SUB_MODES[mode]
    navigateToWorkspacePath(`/${mode}/${defaultSubMode}`)
}

const handleBasicSubModeChange = (mode: SubMode) => {
    if (mode === 'system' || mode === 'user') {
        navigateToWorkspacePath(`/basic/${mode}`)
    }
}

const handleImageSubModeChange = (mode: ImageSubMode) => {
    navigateToWorkspacePath(`/image/${mode}`)
}
</script>
