import { eq } from 'drizzle-orm'
import { schools } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireSuperAdmin } from '../../utils/auth'

// PATCH /api/schools/[id] — 更新学校信息（超级管理员）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  
  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的学校ID' })
  }
  
  const body = await readBody(event) as {
    name?: string
    disabled?: number
  }
  
  if (body.name !== undefined && (!body.name || !body.name.trim())) {
    throw createError({ statusCode: 400, statusMessage: '请输入学校名称' })
  }
  
  const db = useMainDb()
  
  // 检查学校是否存在
  const existing = await db.select().from(schools).where(eq(schools.id, id)).limit(1)
  if (existing.length === 0) {
    throw createError({ statusCode: 404, statusMessage: '学校不存在' })
  }
  
  // 检查名称是否与其他学校重复
  if (body.name !== undefined) {
    const duplicate = await db.select().from(schools).where(eq(schools.name, body.name.trim())).all()
    if (duplicate.length > 0 && duplicate[0].id !== id) {
      throw createError({ statusCode: 400, statusMessage: '学校名称已存在' })
    }
  }
  
  // 更新学校信息
  const setData: Record<string, any> = {}
  if (body.name !== undefined) setData.name = body.name.trim()
  if (body.disabled !== undefined) setData.disabled = body.disabled ? 1 : 0
  
  await db.update(schools)
    .set(setData)
    .where(eq(schools.id, id))
    
  return { success: true, message: '学校信息已更新' }
})
