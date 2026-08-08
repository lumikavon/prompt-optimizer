import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

import AppHeaderActions from '../../../src/components/app-layout/AppHeaderActions.vue'

describe('AppHeaderActions', () => {
  const mountActions = (extraProps: Record<string, unknown> = {}) => {
    return mount(AppHeaderActions, {
      props: {
        ...extraProps,
      },
      global: {
        mocks: {
          $t: (key: string) => {
            const map: Record<string, string> = {
              'nav.templates': 'Templates',
              'nav.history': 'History',
            }
            return map[key] ?? key
          },
        },
        stubs: {
          ThemeToggleUI: true,
          LanguageSwitchDropdown: true,
          ActionButtonUI: defineComponent({
            name: 'ActionButtonUI',
            props: ['text', 'type'],
            emits: ['click'],
            setup(props, { emit, attrs }) {
              return () =>
                h(
                  'button',
                  {
                    ...attrs,
                    class: attrs.class,
                    'data-type': props.type,
                    onClick: () => emit('click'),
                  },
                  props.text,
                )
            },
          }),
        },
      },
    })
  }

  it('renders template and history actions', () => {
    const wrapper = mountActions()

    const modalGroup = wrapper.find('[data-testid="header-modal-actions"]')
    expect(modalGroup.exists()).toBe(true)
    expect(modalGroup.text()).toContain('Templates')
    expect(modalGroup.text()).toContain('History')
    // 已删除的入口不再渲染
    expect(modalGroup.text()).not.toContain('Model Manager')
    expect(modalGroup.text()).not.toContain('Favorite Library')
    expect(modalGroup.text()).not.toContain('Data Manager')
    expect(modalGroup.text()).not.toContain('Variable Manager')
  })

  it('emits open-templates on template button click', async () => {
    const wrapper = mountActions()
    const templateAction = wrapper.findAll('button').find((button) => button.text() === 'Templates')
    expect(templateAction).toBeTruthy()
    await templateAction!.trigger('click')
    expect(wrapper.emitted('open-templates')).toHaveLength(1)
  })

  it('emits open-history on history button click', async () => {
    const wrapper = mountActions()
    const historyAction = wrapper.findAll('button').find((button) => button.text() === 'History')
    expect(historyAction).toBeTruthy()
    await historyAction!.trigger('click')
    expect(wrapper.emitted('open-history')).toHaveLength(1)
  })
})
