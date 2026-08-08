// e2e 分组配置
// 说明：Pro 模式（pro-multi/pro-variable）、图像/文本测试区（test deck）已随 UI 重构移除，
// 相应 spec 已删除；此处只保留现存工作区（2 Basic + 3 Image）的用例。
const groups = {
  gate: [
    'tests/e2e/workflows/p0-route-smoke.spec.ts',
    'tests/e2e/regression/root-route-bootstrap.spec.ts',
    'tests/e2e/optimize/basic-user.spec.ts',
    'tests/e2e/test/image-text2image-generate.spec.ts',
    // 单图生图与多图持久化目前仍依赖较脆弱的 provider/VCR 契约，
    // 先降级到 extended，避免把日常 gate 绑死在高维护成本用例上。
  ],
  extended: [
    'tests/e2e/analysis/basic-system.spec.ts',
    'tests/e2e/analysis/basic-user.spec.ts',
    'tests/e2e/analysis/image-text2image.spec.ts',
    'tests/e2e/analysis/image-image2image.spec.ts',
    'tests/e2e/optimize/basic-system.spec.ts',
    'tests/e2e/test/image-image2image-generate.spec.ts',
    'tests/e2e/session-persistence/image-multiimage-persistence.spec.ts'
  ]
}

module.exports = {
  groups
}
