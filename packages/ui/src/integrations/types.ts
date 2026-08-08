import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { PromptRecordChain } from '@prompt-optimizer/core'

import type { BasicSystemSessionApi } from '../stores/session/useBasicSystemSession'
import type { BasicUserSessionApi } from '../stores/session/useBasicUserSession'
import type { ImageText2ImageSessionApi } from '../stores/session/useImageText2ImageSession'
import type { ImageImage2ImageSessionApi } from '../stores/session/useImageImage2ImageSession'
import type { ImageMultiImageSessionApi } from '../stores/session/useImageMultiImageSession'

export interface OptionalIntegrationsContext {
  router: Pick<Router, 'currentRoute' | 'push' | 'replace'>
  hasRestoredInitialState: Ref<boolean>
  isLoadingExternalData: Ref<boolean>

  basicSystemSession: BasicSystemSessionApi
  basicUserSession: BasicUserSessionApi
  imageText2ImageSession: ImageText2ImageSessionApi
  imageImage2ImageSession: ImageImage2ImageSessionApi
  imageMultiImageSession: ImageMultiImageSessionApi
  optimizerCurrentVersions: Ref<PromptRecordChain['versions']>
}

export interface OptionalIntegration {
  /** Stable identifier for logging / debugging. */
  id: string
  /** Env var name used to enable the integration. */
  envFlag: string
  /** Register integration side-effects (watchers, listeners, etc.). */
  register: (ctx: OptionalIntegrationsContext) => void | Promise<void>
}
