// 子模式键（上下文/Pro 模式已删除）
export type SubModeKey =
  | 'basic-system'
  | 'basic-user'
  | 'image-text2image'
  | 'image-image2image'
  | 'image-multiimage'

export const SESSION_SUB_MODE_KEYS = [
  'basic-system',
  'basic-user',
  'image-text2image',
  'image-image2image',
  'image-multiimage',
] as const satisfies readonly SubModeKey[]

export const SESSION_STORAGE_KEYS: Record<SubModeKey, string> = {
  'basic-system': 'session/v1/basic-system',
  'basic-user': 'session/v1/basic-user',
  'image-text2image': 'session/v1/image-text2image',
  'image-image2image': 'session/v1/image-image2image',
  'image-multiimage': 'session/v1/image-multiimage',
}
