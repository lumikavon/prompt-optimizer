import { describe, expect, it, vi, afterEach } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { beforeRouteSwitch, parseSubModeKey } from '../../../src/router/guards'
import {
  normalizeWorkspacePath,
  parseWorkspaceRoutePath,
  resolveWorkspacePathFallback,
} from '../../../src/router/workspaceRoutes'

function createRoute(
  path: string,
  overrides: Partial<RouteLocationNormalized> = {},
): RouteLocationNormalized {
  return {
    path,
    query: {},
    hash: '',
    ...overrides,
  } as RouteLocationNormalized
}

describe('router guards', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseSubModeKey', () => {
    it('parses valid sub mode paths', () => {
      expect(parseSubModeKey('/basic/system')).toBe('basic-system')
      expect(parseSubModeKey('/image/text2image')).toBe('image-text2image')
      expect(parseSubModeKey('/image/multiimage')).toBe('image-multiimage')
    })

    it('returns null for invalid sub mode paths', () => {
      // 上下文模式（Pro）已删除：/pro/* 不再视为有效工作区路由
      expect(parseSubModeKey('/pro/multi')).toBeNull()
      expect(parseSubModeKey('/pro/system')).toBeNull()
      expect(parseSubModeKey('/image/unknown')).toBeNull()
      expect(parseSubModeKey('/other/path')).toBeNull()
      expect(parseSubModeKey('/favorites')).toBeNull()
    })
  })

  describe('workspace route helpers', () => {
    it('parses and normalizes workspace routes only', () => {
      expect(parseWorkspaceRoutePath('/basic/system')?.subModeKey).toBe('basic-system')
      expect(normalizeWorkspacePath('/image/text2image')).toBe('/image/text2image')
      // 上下文模式（Pro）已删除：/pro/* 不再归一化为工作区路径
      expect(normalizeWorkspacePath(['/pro/variable'])).toBeNull()
      expect(normalizeWorkspacePath('/favorites')).toBeNull()
      expect(normalizeWorkspacePath('/image/unknown')).toBeNull()
    })

    it('resolves workspace fallbacks in caller priority order', () => {
      expect(resolveWorkspacePathFallback('/favorites', '/image/multiimage', '/basic/user')).toBe('/image/multiimage')
      // 上下文模式（Pro）已删除：所有候选无效时回退到默认工作区
      expect(resolveWorkspacePathFallback(undefined, '/image/unknown', '/pro/variable')).toBe('/basic/system')
      expect(resolveWorkspacePathFallback('/favorites')).toBe('/basic/system')
    })
  })

  describe('beforeRouteSwitch', () => {
    it('does not redirect legacy pro routes (context mode removed)', () => {
      // 上下文模式（Pro）已删除：旧 /pro/* 路由不再被识别，也不做重定向
      expect(beforeRouteSwitch(createRoute('/pro/system'), createRoute('/'), undefined as never)).toBe(true)
      expect(beforeRouteSwitch(createRoute('/pro/user'), createRoute('/'), undefined as never)).toBe(true)
      expect(beforeRouteSwitch(createRoute('/pro/multi'), createRoute('/'), undefined as never)).toBe(true)
    })

    it('redirects invalid image sub mode to the default image route', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = beforeRouteSwitch(createRoute('/image/unknown'), createRoute('/'), undefined as never)

      expect(result).toEqual({ path: '/image/text2image', query: {}, hash: '' })
      expect(warnSpy).toHaveBeenCalledOnce()
    })

    it('does not redirect non-workspace routes that only share a prefix', () => {
      expect(beforeRouteSwitch(createRoute('/profile'), createRoute('/'), undefined as never)).toBe(true)
      expect(beforeRouteSwitch(createRoute('/project'), createRoute('/'), undefined as never)).toBe(true)
      expect(beforeRouteSwitch(createRoute('/process'), createRoute('/'), undefined as never)).toBe(true)
    })

    it('allows valid routes to continue', () => {
      const result = beforeRouteSwitch(createRoute('/basic/user'), createRoute('/'), undefined as never)

      expect(result).toBe(true)
    })

    it('allows the root route to continue', () => {
      const result = beforeRouteSwitch(createRoute('/'), createRoute('/basic/system'), undefined as never)

      expect(result).toBe(true)
    })
  })
})
