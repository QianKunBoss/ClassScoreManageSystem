import { eq } from 'drizzle-orm'
import { seatLayoutConfig } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET/PATCH /api/seats/layout — 获取/更新座位布局配置（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const body = event.method === 'PATCH' ? await readBody(event) as any : null

  // 获取 classId：从 query（GET）或 body（PATCH）中获取
  let classId = event.method === 'PATCH'
    ? (body!.classId ?? body!.class_id)
    : (getQuery(event).classId ?? getQuery(event).class_id)

  // 班级管理员：自动使用自己管理的班级，且只能操作自己的班级
  if (admin.role === 'class_admin') {
    if (!classId) {
      classId = admin.classId
    } else if (Number(classId) !== admin.classId) {
      throw createError({ statusCode: 403, statusMessage: '只能管理自己班级的座位布局' })
    }
  }

  if (!classId) {
    throw createError({ statusCode: 400, statusMessage: '缺少 classId 参数' })
  }

  const classIdNum = Number(classId)

  // PATCH：upsert 布局配置
  if (event.method === 'PATCH') {
    const existing = await db.select().from(seatLayoutConfig)
      .where(eq(seatLayoutConfig.classId, classIdNum)).get()

    const now = new Date().toISOString()

    if (existing) {
      await db.update(seatLayoutConfig)
        .set({
          groupCount: body!.groupCount ?? existing.groupCount,
          rowsPerGroup: body!.rowsPerGroup ?? existing.rowsPerGroup,
          colsPerGroup: body!.colsPerGroup ?? existing.colsPerGroup,
          hasAisle: body!.hasAisle ?? existing.hasAisle,
        })
        .where(eq(seatLayoutConfig.classId, classIdNum))
    } else {
      await db.insert(seatLayoutConfig).values({
        classId: classIdNum,
        groupCount: body!.groupCount ?? 4,
        rowsPerGroup: body!.rowsPerGroup ?? 3,
        colsPerGroup: body!.colsPerGroup ?? 3,
        hasAisle: body!.hasAisle ?? 0,
      })
    }

    const updated = await db.select().from(seatLayoutConfig)
      .where(eq(seatLayoutConfig.classId, classIdNum)).get()
    return { data: updated }
  }

  // GET：获取布局配置
  const config = await db.select().from(seatLayoutConfig)
    .where(eq(seatLayoutConfig.classId, classIdNum)).get()
  return { data: config }
})
