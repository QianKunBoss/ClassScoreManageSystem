import { requireSuperAdmin } from '../../utils/auth'
import { mailTemplates } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'

// POST /api/mail-templates — 创建邮件模板
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody(event)
  const name = (body.name || '').toString().trim()
  const slug = (body.slug || '').toString().trim()

  if (!name) throw createError({ statusCode: 400, message: '请填写模板名称' })
  if (!slug) throw createError({ statusCode: 400, message: '请填写模板标识（slug）' })
  if (!/^[\w-]+$/.test(slug)) throw createError({ statusCode: 400, message: '模板标识只能包含字母、数字、下划线和连字符' })

  const db = useMainDb()
  const exists = await db.select().from(mailTemplates).where(eq(mailTemplates.slug, slug)).get()
  if (exists) throw createError({ statusCode: 400, message: '模板标识已存在' })

  const result = await db.insert(mailTemplates).values({
    slug,
    name,
    subject: (body.subject || '').toString(),
    bodyHtml: (body.bodyHtml || '').toString(),
    variables: Array.isArray(body.variables) ? JSON.stringify(body.variables) : (body.variables || '[]'),
    updatedAt: new Date().toISOString(),
  }).returning().get()

  return { success: true, data: result, message: '模板已创建' }
})
