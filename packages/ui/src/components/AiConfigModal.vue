<template>
    <NModal
        v-model:show="isVisible"
        preset="card"
        :title="t('aiConfig.title')"
        :style="{ width: '540px', maxWidth: '90vw' }"
        :mask-closable="false"
        @after-leave="handleAfterLeave"
    >
        <NAlert
            v-if="loadError"
            type="warning"
            :show-icon="true"
            style="margin-bottom: 12px"
        >
            {{ loadError }}
        </NAlert>

        <NForm label-placement="top" :show-require-mark="false" style="margin-top: 8px">
            <NFormItem :label="t('aiConfig.baseUrl')">
                <NInput
                    v-model:value="form.base_url"
                    placeholder="https://api.openai.com/v1"
                    clearable
                />
            </NFormItem>
            <NFormItem :label="t('aiConfig.apiKey')">
                <NInput
                    v-model:value="form.api_key"
                    type="password"
                    show-password-on="click"
                    placeholder="sk-..."
                    clearable
                />
            </NFormItem>
            <NFormItem :label="t('aiConfig.model')">
                <NFlex vertical :size="8" style="width: 100%">
                    <!-- 输入选择框：可自由输入模型名，也可下拉选择 models 接口返回的可用模型 -->
                    <NAutoComplete
                        v-model:value="form.model"
                        :options="modelSelectOptions"
                        :loading="loadingModels"
                        placeholder="gpt-4o"
                        clearable
                        @focus="loadModelOptions"
                    />
                    <NFlex justify="space-between" align="center" :wrap="false">
                        <NText
                            v-if="testMessage"
                            :type="testOk ? 'success' : 'error'"
                            style="font-size: 12px; word-break: break-all;"
                        >
                            {{ testMessage }}
                        </NText>
                        <!-- 模型测试按钮：点击后完成一次 API 调用测试 -->
                        <NButton
                            size="small"
                            :loading="testing"
                            :disabled="testing || !form.model?.trim()"
                            @click="handleTest"
                        >
                            {{ testing ? t('aiConfig.testing') : t('aiConfig.testButton') }}
                        </NButton>
                    </NFlex>
                </NFlex>
            </NFormItem>
        </NForm>

        <NText depth="3" style="font-size: 12px; word-break: break-all;">
            {{ t('aiConfig.configPath') }}：{{ configPath || t('aiConfig.unknownPath') }}
        </NText>
        <NText depth="3" style="font-size: 12px; display: block; margin-top: 4px;">
            {{ t('aiConfig.restartNote') }}
        </NText>

        <template #footer>
            <NFlex justify="space-between" align="center" :wrap="false">
                <NText v-if="saveMessage" :type="saveOk ? 'success' : 'error'" style="font-size: 12px">
                    {{ saveMessage }}
                </NText>
                <NFlex justify="end" :size="8" style="margin-left: auto">
                    <NButton @click="isVisible = false">
                        {{ t('common.cancel') }}
                    </NButton>
                    <NButton type="primary" :loading="saving" @click="handleSave">
                        {{ t('common.save') }}
                    </NButton>
                </NFlex>
            </NFlex>
        </template>
    </NModal>
</template>

<script setup lang="ts">
/**
 * AiConfigModal - 优化模型配置查看/修改弹窗（桌面端）
 *
 * 读取并修改 ~/.config/ai.yml 中的 .ai.openai.{base_url, api_key, model}。
 * 仅在 Electron 桌面环境可用（通过 preload 暴露的 electronAPI.aiConfig 与主进程通信）。
 */
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NForm, NFormItem, NInput, NAutoComplete, NButton, NFlex, NText, NAlert, type AutoCompleteOption } from 'naive-ui'
import type { TextModelConfig } from '@prompt-optimizer/core'
import { getProviderDisplayName, getTextModelConfigDisplayName } from '../utils/provider-display'

interface AiConfigPayload {
    base_url?: string
    api_key?: string
    model?: string
}

interface AiConfigAPI {
    get: () => Promise<{
        config: AiConfigPayload | null
        configPath: string
        error: string | null
    }>
    set: (config: AiConfigPayload) => Promise<{ ok: boolean; configPath: string; message: string }>
    /** 通过 models 接口获取可用模型（使用表单中的 base_url/api_key） */
    fetchModels: (config: AiConfigPayload) => Promise<{ value: string; label: string }[]>
    /** 测试 API 连接（使用表单中的 base_url/api_key/model） */
    test: (config: AiConfigPayload) => Promise<{ ok: boolean; content: string }>
}

interface ModelsAPI {
    /** models 接口：查询已启用的模型配置，用于模型下拉选取 */
    getEnabledModels: () => Promise<TextModelConfig[]>
}

type AiModelOption = AutoCompleteOption

const { t } = useI18n()

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const electronAPI = (window as unknown as { electronAPI?: { aiConfig?: AiConfigAPI; model?: ModelsAPI } })?.electronAPI
const isDesktop = Boolean(electronAPI?.aiConfig)

const isVisible = ref(props.modelValue)
watch(() => props.modelValue, async (newVal) => {
    isVisible.value = newVal
    if (newVal && isDesktop) {
        // 先读取已保存配置再加载模型列表，避免在 api_key/base_url 尚未填充时
        // 用空 key 请求 models 接口（网关会以 401 拒绝，见 main.js ai-config-fetchModels）
        await loadConfig()
        void loadModelOptions()
    }
})
watch(isVisible, (newVal) => {
    if (!newVal) emit('update:modelValue', false)
})

const form = reactive<AiConfigPayload>({ base_url: '', api_key: '', model: '' })
const configPath = ref('')
const loadError = ref('')
const saveMessage = ref('')
const saveOk = ref(false)
const saving = ref(false)

// 模型下拉：聚焦时通过 models 接口获取可用模型（使用表单中的 base_url/api_key），供"优化模型配置"选择
const modelOptions = ref<AiModelOption[]>([])
const loadingModels = ref(false)

// 兜底来源：本地已启用的模型配置列表（models 接口不可用/失败时使用）
const buildLocalOptions = async (): Promise<AiModelOption[]> => {
    if (!electronAPI?.model?.getEnabledModels) return []
    const models = await electronAPI.model.getEnabledModels()
    const seen = new Set<string>()
    const list: AiModelOption[] = []
    for (const m of models ?? []) {
        const id = m.modelMeta?.id?.trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        const provider = getProviderDisplayName(m.providerMeta, t)
        const modelName = getTextModelConfigDisplayName(m, t)
        list.push({
            value: id,
            label:
                provider && modelName && provider !== modelName
                    ? `${provider} / ${modelName}`
                    : modelName || id,
        })
    }
    return list
}

const loadModelOptions = async () => {
    loadingModels.value = true
    try {
        let list: AiModelOption[] = []
        const baseUrl = form.base_url?.trim()
        const apiKey = form.api_key?.trim()
        // 主路径：下拉时通过 models 接口获取可用模型（使用表单中的 base_url/api_key）。
        // 仅在至少提供一个连接字段时才请求，避免空 key 请求被网关以 401 拒绝。
        if (electronAPI?.aiConfig?.fetchModels && (baseUrl || apiKey)) {
            const fetched = await electronAPI.aiConfig.fetchModels({
                base_url: baseUrl || undefined,
                api_key: apiKey || undefined,
            })
            list = (fetched ?? []).map((m) => ({ value: m.value, label: m.label }))
        }
        // 兜底：models 接口不可用或未返回任何模型时，退回本地已启用模型列表
        if (list.length === 0) {
            list = await buildLocalOptions()
        }
        modelOptions.value = list
    } catch (error) {
        console.warn('[AiConfigModal] 加载模型列表失败，退回本地已启用模型:', String((error as Error)?.message ?? error))
        try {
            modelOptions.value = await buildLocalOptions()
        } catch (localError) {
            console.warn('[AiConfigModal] 加载本地模型列表也失败:', String((localError as Error)?.message ?? localError))
        }
    } finally {
        loadingModels.value = false
    }
}

// 当前 ai.yml 中的模型可能不在下拉列表内：补充为选项，保证输入框能回显
const modelSelectOptions = computed<AiModelOption[]>(() => {
    const current = form.model?.trim()
    if (current && !modelOptions.value.some((o) => o.value === current)) {
        return [{ value: current, label: current }, ...modelOptions.value]
    }
    return modelOptions.value
})

const loadConfig = async () => {
    loadError.value = ''
    saveMessage.value = ''
    testMessage.value = ''
    testOk.value = false
    try {
        const result = await electronAPI!.aiConfig!.get()
        configPath.value = result.configPath
        if (result.error) {
            loadError.value = result.error
        }
        form.base_url = result.config?.base_url ?? ''
        form.api_key = result.config?.api_key ?? ''
        form.model = result.config?.model ?? ''
    } catch (error) {
        loadError.value = String((error as Error)?.message ?? error)
    }
}

// 模型测试：点击后完成一次 API 调用测试
const testing = ref(false)
const testMessage = ref('')
const testOk = ref(false)

const handleTest = async () => {
    if (!isDesktop || testing.value) return
    testing.value = true
    testMessage.value = ''
    testOk.value = false
    try {
        const result = await electronAPI!.aiConfig!.test({
            base_url: form.base_url?.trim() || undefined,
            api_key: form.api_key?.trim() || undefined,
            model: form.model?.trim() || undefined,
        })
        testOk.value = Boolean(result.ok)
        testMessage.value = result.ok
            ? t('aiConfig.testSuccess')
            : `${t('aiConfig.testFailed')}：${String(result.content ?? '')}`
    } catch (error) {
        testOk.value = false
        testMessage.value = `${t('aiConfig.testFailed')}：${String((error as Error)?.message ?? error)}`
    } finally {
        testing.value = false
    }
}

const handleSave = async () => {
    if (!isDesktop || saving.value) return
    saving.value = true
    saveMessage.value = ''
    try {
        const result = await electronAPI!.aiConfig!.set({
            base_url: form.base_url?.trim() || undefined,
            api_key: form.api_key?.trim() || undefined,
            model: form.model?.trim() || undefined,
        })
        saveOk.value = result.ok
        saveMessage.value = result.ok ? t('aiConfig.saveSuccess') : result.message
    } catch (error) {
        saveOk.value = false
        saveMessage.value = `${t('aiConfig.saveFailed')}：${String((error as Error)?.message ?? error)}`
    } finally {
        saving.value = false
    }
}

const handleAfterLeave = () => {
    emit('update:modelValue', false)
}
</script>
