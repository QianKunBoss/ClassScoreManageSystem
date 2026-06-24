// PATCH /api/users/role — 批量更新用户角色
// ⚠️ 此接口当前不可用：users 表无 role 字段，仅 admins 表有 role
// 如需实现此功能，请明确需求后重构
export default defineEventHandler(async (event) => {
  throw createError({
    statusCode: 501,
    statusMessage: '此接口暂不可用（users 表无 role 字段）',
  })
})
