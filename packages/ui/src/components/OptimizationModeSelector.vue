<!-- 优化模式选择器组件 - 使用 Naive UI RadioGroup -->
<template>
  <NRadioGroup data-testid="optimization-mode-selector"
    :value="modelValue"
    @update:value="updateOptimizationMode"
    size="small"
    class="optimization-mode-selector"
  >
    <!-- 基础模式：系统 | 用户 -->
    <NRadioButton
      v-if="!hideSystemOption"
      data-testid="sub-mode-system"
      value="system"
      :title="systemHelp"
      @click="handleModeClick('system')"
    >
      {{ systemLabel }}
    </NRadioButton>
    <NRadioButton
      data-testid="sub-mode-user"
      value="user"
      :title="userHelp"
      @click="handleModeClick('user')"
    >
      {{ userLabel }}
    </NRadioButton>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { BasicSubMode } from '@prompt-optimizer/core'

type SubMode = BasicSubMode

interface Props {
  modelValue: SubMode
  /** 是否隐藏系统提示词选项（用于临时禁用功能） */
  hideSystemOption?: boolean
  allowReselect?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: SubMode): void
  (e: 'change', value: SubMode): void
}

const props = withDefaults(defineProps<Props>(), {
  hideSystemOption: false,
  allowReselect: false,
})
const emit = defineEmits<Emits>()

const { t } = useI18n()

// 根据功能模式动态获取按钮文本（上下文模式已删除，恒为基础模式文案）
const systemLabel = computed(() => {
  return t('promptOptimizer.systemPrompt')
})

const userLabel = computed(() => {
  return t('promptOptimizer.userPrompt')
})

const systemHelp = computed(() => {
  return t('promptOptimizer.systemPromptHelp')
})

const userHelp = computed(() => {
  return t('promptOptimizer.userPromptHelp')
})

/**
 * 更新优化模式
 */
const updateOptimizationMode = (mode: SubMode) => {
  emit('update:modelValue', mode)
  emit('change', mode)
}

const handleModeClick = (mode: SubMode) => {
  if (props.allowReselect && props.modelValue === mode) {
    emit('change', mode)
  }
}
</script>

<style scoped>
/* 响应式设计 - 移动端全宽显示 */
@media (max-width: 640px) {
  .optimization-mode-selector {
    width: 100%;
  }

  .optimization-mode-selector :deep(.n-radio-button) {
    flex: 1;
  }
}
</style>
