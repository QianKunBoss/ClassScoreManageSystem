// 客户端模板渲染（与服务端 server/utils/mail.ts 的 renderString 规则一致）
export function renderTemplate(
  tpl: string,
  vars: Record<string, string>,
): string {
  if (!tpl) return ''
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

// 根据变量名生成合理的示例值，用于模板预览
export function sampleValueFor(key: string): string {
  const map: Record<string, string> = {
    code: '123456',
    email: 'student@example.com',
    expiresMinutes: '10',
    schoolName: '示范学校',
    applicantName: '张三',
    loginUrl: 'https://csms.example.com/login',
    reason: '提交的资料不完整，请补充后重新提交。',
  }
  return map[key] ?? `{{${key}}}`
}
