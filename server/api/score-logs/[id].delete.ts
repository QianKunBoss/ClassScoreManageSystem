import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'
import { revokeScoreLog } from '../../utils/score-service'

// DELETE /api/score-logs/[id] — 删除积分记录（学校库）
//
// 【安全】历史实现直接 DELETE，既没有管理范围校验（班级管理员可删任意班级的记录），
// 也没有回滚 users 的积分汇总字段。现改为复用 revokeScoreLog 统一处理。
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const scope = await resolveSchoolScope(admin, db)

  const id = Number(getRouterParam(event, 'id'))

  await revokeScoreLog({ db, scope, logId: id })

  return { success: true, message: '记录已删除' }
})
