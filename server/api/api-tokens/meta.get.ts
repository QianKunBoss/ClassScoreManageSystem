// GET /api/api-tokens/meta — 签发表单所需的元数据
//
// 把「有哪些权限项、哪些是危险项、当前管理员能签发什么范围」这些规则放在服务端，
// 前端只负责渲染。否则新增一个 scope 就要改两处，前后端迟早不一致 ——
// 而权限清单不一致的后果是：界面上勾不到的权限，实际却可以通过手搓请求拿到。

import { requireAdmin } from '../../utils/auth'
import { API_SCOPES, DANGEROUS_SCOPES } from '../../utils/api-token'

/** scope → 中文说明。与 docs/API.md 的措辞保持一致 */
const SCOPE_LABELS: Record<string, { label: string; group: string; desc: string }> = {
  'students:read': { label: '查看学生', group: '学生', desc: '读取学生名单、档案与积分汇总' },
  'students:write': { label: '新增/修改学生', group: '学生', desc: '创建学生账号、改名、启用禁用、转班' },
  'students:delete': { label: '删除学生', group: '学生', desc: '级联删除该学生的积分流水与座位数据' },
  'scores:read': { label: '查看积分记录', group: '积分', desc: '读取积分流水明细' },
  'scores:write': { label: '加分/减分', group: '积分', desc: '写入积分变更（最常用的对接能力）' },
  'scores:revoke': { label: '撤销积分记录', group: '积分', desc: '删除一条流水并回滚学生积分汇总' },
  'structure:read': { label: '查看年级班级', group: '组织结构', desc: '读取年级、班级列表' },
  'structure:write': { label: '新增/修改年级班级', group: '组织结构', desc: '创建或重命名年级、班级' },
  'structure:delete': { label: '删除年级班级', group: '组织结构', desc: '级联删除其下全部班级与学生' },
  'templates:read': { label: '查看积分模板', group: '积分模板', desc: '读取加减分模板' },
  'templates:write': { label: '管理积分模板', group: '积分模板', desc: '新增、修改、删除积分模板' },
  'stats:read': { label: '查看统计', group: '统计', desc: '读取范围内的统计概览与排行' },
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  // 可签发的范围类型：不得超过自身管辖层级
  let scopeTypes: string[]
  if (admin.role === 'super_admin' || admin.role === 'school_admin') {
    scopeTypes = ['school', 'grade', 'class']
  } else if (admin.role === 'grade_admin') {
    scopeTypes = ['grade', 'class']
  } else {
    scopeTypes = ['class']
  }

  return {
    success: true,
    data: {
      scopes: API_SCOPES.map((s) => ({
        key: s,
        ...(SCOPE_LABELS[s] || { label: s, group: '其他', desc: '' }),
        dangerous: (DANGEROUS_SCOPES as readonly string[]).includes(s),
      })),
      scopeTypes,
      /** 供前端锁定选择器：年级管理员只能选自己年级，班级管理员只能选自己班 */
      fixedGradeId: admin.role === 'grade_admin' ? admin.gradeId ?? null : null,
      fixedClassId: admin.role === 'class_admin' ? admin.classId ?? null : null,
      role: admin.role,
      maxExpireDays: 1825,
    },
  }
})
