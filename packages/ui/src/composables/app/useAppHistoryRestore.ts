/**
 * App 级别历史记录恢复 Composable
 *
 * 负责从历史记录恢复时的智能模式切换和状态恢复逻辑。
 * 包括：
 * - 根据记录类型自动切换功能模式（basic/pro/image）
 * - 自动切换子模式（system/user）
 * - 恢复会话快照和消息级优化状态
 */

import { nextTick, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import type {
    PromptAssetBinding,
    PromptRecord,
    PromptRecordChain,
    IHistoryManager,
    OptimizationMode,
    PromptSessionOrigin,
} from '@prompt-optimizer/core'
import { extractHistorySourceBinding } from '../../utils/history-source-binding'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object'

/**
 * 历史记录上下文
 */
export interface HistoryContext {
    record: PromptRecord
    chainId: string
    rootPrompt: string
    chain: PromptRecordChain
}

/**
 * 工作区组件引用类型
 */
interface WorkspaceRef {
    restoreFromHistory?: (payload: unknown) => void | Promise<void>
}

/**
 * useAppHistoryRestore 的配置选项
 */
export interface AppHistoryRestoreOptions {
    /** 服务实例 */
    services: Ref<{ historyManager: IHistoryManager } | null>
    /** 🔧 Step D: 路由导航函数（替代 setFunctionMode/set*SubMode） */
    navigateToSubModeKey: (toKey: string, opts?: { replace?: boolean }) => boolean | void | Promise<boolean | void>
    /** 处理历史记录选择 */
    handleSelectHistory: (context: HistoryContext) => Promise<void>
    /** i18n 翻译函数 */
    t: (key: string, params?: Record<string, unknown>) => string
    /** 外部数据加载中标志（防止模式切换的自动 restore 覆盖外部数据） */
    isLoadingExternalData: Ref<boolean>
    /** 将历史记录中的来源资产坐标恢复到目标工作区 session */
    restoreSourceBindingForTargetKey?: (
        targetKey: string,
        state: { assetBinding?: PromptAssetBinding; origin?: PromptSessionOrigin },
    ) => void
    /** Persist the target workspace session after a history restore writes its session pointers. */
    saveSessionForTargetKey?: (targetKey: string) => void | Promise<void>
}

/**
 * useAppHistoryRestore 的返回值
 */
export interface AppHistoryRestoreReturn {
    /** 处理历史记录恢复（带错误处理） */
    handleHistoryReuse: (context: HistoryContext) => Promise<void>
}

/**
 * App 级别历史记录恢复 Composable
 */
export function useAppHistoryRestore(options: AppHistoryRestoreOptions): AppHistoryRestoreReturn {
    const {
        services,
        navigateToSubModeKey,
        handleSelectHistory,
        t,
        isLoadingExternalData,
        restoreSourceBindingForTargetKey,
        saveSessionForTargetKey,
    } = options

    const toast = useToast()

    const persistRestoredSession = async (targetKey: string) => {
        if (!saveSessionForTargetKey) return

        try {
            await saveSessionForTargetKey(targetKey)
        } catch (error) {
            console.error(`[App] Failed to save restored history session for ${targetKey}:`, error)
            toast.warning(t('toast.warning.saveHistoryFailed'))
        }
    }

    /**
     * 处理历史记录使用 - 智能模式切换（内部实现）
     */
    const handleHistoryReuseImpl = async (context: HistoryContext) => {
        const { record, chain } = context
        // rootRecord.type 可能包含旧版本类型名，显式转为 string 以兼容历史数据
        const rt = chain.rootRecord.type as unknown as string

        // 🆕 扩展模式切换逻辑 - 支持图像模式
        if (
            rt === 'imageOptimize' ||
            rt === 'contextImageOptimize' ||
            rt === 'imageIterate' ||
            rt === 'text2imageOptimize' ||
            rt === 'image2imageOptimize' ||
            rt === 'multiimageOptimize'
        ) {
            // 图像模式：使用 navigateToSubModeKey 导航
            // 根据记录类型设置正确的图像子模式
            const meta = (isRecord(record.metadata) ? record.metadata : null) ??
                (isRecord(chain.rootRecord.metadata) ? chain.rootRecord.metadata : null)
            const hasInputImage = isRecord(meta) && meta.hasInputImage === true
            const imageMode =
                rt === 'text2imageOptimize'
                    ? 'text2image'
                    : rt === 'image2imageOptimize'
                      ? 'image2image'
                      : rt === 'multiimageOptimize'
                        ? 'multiimage'
                      : hasInputImage
                        ? 'image2image'
                        : 'text2image' // 默认为文生图模式

            // 🔧 Step D: 使用 navigateToSubModeKey 替代 setImageSubMode
            const targetKey = `image-${imageMode}`
            const didNavigate = await navigateToSubModeKey(targetKey)
            if (didNavigate === false) {
                throw new Error(`Invalid image workspace target: ${targetKey}`)
            }
            toast.info(t('toast.info.switchedToImageMode'))

            // 🆕 图像模式专用数据回填逻辑
            // 等待路由切换完成后再回填数据
            await nextTick()
            restoreSourceBindingForTargetKey?.(
                targetKey,
                extractHistorySourceBinding(record, chain),
            )

            // 🆕 图像模式专用数据回填逻辑
            const imageHistoryData = {
                originalPrompt: record.originalPrompt || chain.rootRecord.originalPrompt,
                optimizedPrompt: record.optimizedPrompt,
                metadata: record.metadata || chain.rootRecord.metadata,
                chainId: chain.chainId,
                versions: chain.versions,
                currentVersionId: record.id,
                imageMode: imageMode, // 添加图像模式信息
                templateId: record.templateId || chain.rootRecord.templateId, // 添加模板ID以便恢复模板选择
            }

            // 触发图像工作区数据恢复事件
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('image-workspace-restore', {
                        detail: imageHistoryData,
                    }),
                )
            }

            await persistRestoredSession(targetKey)
            toast.success(t('toast.success.imageHistoryRestored'))
            return // 图像模式不需要调用原有的历史记录处理逻辑
        } else {
            // 根据根记录类型确定应该切换到的优化模式（Basic 模式）
            // 历史数据中的上下文模式记录（conversationMessageOptimize/contextSystemOptimize
            // /contextUserOptimize/contextIterate）在上下文模式删除后回退到 Basic 模式恢复
            let targetMode: OptimizationMode
            if (rt === 'optimize') {
                targetMode = 'system'
            } else if (rt === 'userOptimize') {
                targetMode = 'user'
            } else {
                // 兜底：从根记录的 metadata 中获取优化模式
                targetMode = chain.rootRecord.metadata?.optimizationMode || 'system'
            }

            // 🔧 Step D: 使用 navigateToSubModeKey 一次性导航到目标路由
            const targetKey = `basic-${targetMode}`
            const didNavigate = await navigateToSubModeKey(targetKey)
            if (didNavigate === false) {
                throw new Error(`Invalid workspace target: ${targetKey}`)
            }

            // 等待路由切换完成
            await nextTick()
            restoreSourceBindingForTargetKey?.(
                targetKey,
                extractHistorySourceBinding(record, chain),
            )

            // 更新 toast 提示（如果需要）
            toast.info(
                t('toast.info.optimizationModeAutoSwitched', {
                    mode: targetMode === 'system' ? t('common.system') : t('common.user'),
                }),
            )

            // ❶ 调用原有的历史记录处理逻辑（更新全局 optimizer 状态）
            await handleSelectHistory(context)

            await persistRestoredSession(targetKey)
        }
    }

    /**
     * 历史记录恢复的错误处理包装器
     */
    const handleHistoryReuse = async (context: HistoryContext) => {
        try {
            // 🔧 设置外部数据加载标志，防止模式切换的自动 restore 覆盖外部数据
            isLoadingExternalData.value = true

            await handleHistoryReuseImpl(context)
        } catch (error) {
            // 捕获历史记录恢复过程中的所有错误
            console.error('[App] Failed to restore history:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            toast.error(t('toast.error.historyRestoreFailed', { error: errorMessage }))
        } finally {
            // 🔧 恢复完成，重置标志，允许正常的模式切换 restore
            isLoadingExternalData.value = false
        }
    }

    return {
        handleHistoryReuse,
    }
}
