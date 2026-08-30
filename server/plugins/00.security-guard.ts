/**
 * 启动期安全守卫（Nitro Plugin）
 * ------------------------------------------------------------------
 * 【为什么必须有】
 * 会话 Cookie 是 iron-webcrypto 密封票据，其完整性完全依赖 SESSION_SECRET。
 * 一旦密钥可预测（例如使用代码里写死的默认值），攻击者可在本地离线伪造
 * 任意管理员（含 super_admin）的合法会话，从而绕过系统全部鉴权逻辑。
 * 因此「生产环境跑起来但用着默认密钥」这件事，比服务起不来危险得多。
 *
 * 【策略】
 *  - 开发环境：仅打印告警（nuxt-auth-utils 会自动生成随机密钥并写入 .env）
 *  - 生产环境：校验不通过则
 *      1) 打印带修复指引的醒目错误
 *      2) 注册请求级 503 兜底（万一宿主吞掉启动异常，也绝不对外服务）
 *      3) 抛出异常 —— Nitro 的 runNitroPlugins 会 rethrow，进程直接退出
 *
 * 文件名前缀 00. 保证它在其它 server plugin（如 db-init）之前执行。
 */

/** 已知的示例 / 历史默认密钥，出现即视为不安全 */
const KNOWN_WEAK_SECRETS = new Set([
  'csms-dev-secret-change-in-production',
  'change-this-to-a-random-secret',
  'csms-session-secret',
  'change-me',
  'changeme',
  'secret',
  'password',
  'test',
])

/** iron 密封要求 >= 32 字节，低于此长度直接不安全 */
const MIN_SECRET_LENGTH = 32

/** 审计会话密钥，返回问题列表（空数组 = 通过） */
function auditSessionSecret(raw: unknown): string[] {
  const problems: string[] = []
  const secret = typeof raw === 'string' ? raw.trim() : ''

  if (!secret) {
    problems.push('未配置会话密钥（SESSION_SECRET / NUXT_SESSION_PASSWORD 均为空）')
    return problems
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`会话密钥长度不足：当前 ${secret.length} 字符，要求至少 ${MIN_SECRET_LENGTH} 字符`)
  }

  if (KNOWN_WEAK_SECRETS.has(secret.toLowerCase())) {
    problems.push('会话密钥使用了示例/默认值，必须替换为随机值')
  }

  // 粗略熵检查：字符种类过少（如 "aaaa...."）视为不安全
  if (new Set(secret).size < 8) {
    problems.push('会话密钥字符种类过少，随机性不足')
  }

  return problems
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()

  // 实际生效的密钥：环境变量 NUXT_SESSION_PASSWORD 优先（nuxt-auth-utils 的取值顺序）
  const effectiveSecret
    = process.env.NUXT_SESSION_PASSWORD
      || (config.session as { password?: string } | undefined)?.password
      || ''

  const problems = auditSessionSecret(effectiveSecret)
  if (problems.length === 0) return

  const detail = problems.map((p, i) => `  ${i + 1}. ${p}`).join('\n')

  // ---------- 开发环境：告警即可 ----------
  if (import.meta.dev) {
    console.warn(
      '\n[CSMS][安全告警] 会话密钥配置存在问题（开发环境不阻断）：\n'
      + `${detail}\n`
      + '  开发环境下 nuxt-auth-utils 会自动生成随机密钥并写入 .env。\n',
    )
    return
  }

  // ---------- 生产环境：拒绝服务 ----------
  const fatal
    = '\n============================================================\n'
      + '[CSMS][FATAL] 会话密钥配置不安全，已拒绝启动\n'
      + '============================================================\n'
      + `${detail}\n`
      + '------------------------------------------------------------\n'
      + '修复方式：\n'
      + '  1) 生成随机密钥：openssl rand -hex 32\n'
      + '  2) 设置运行时会话密钥（任选其一，预构建产物必须用 NUXT_SESSION_PASSWORD）：\n'
      + '     - NUXT_SESSION_PASSWORD=<随机值>  （运行时实时读取，推荐，适用所有部署方式）\n'
      + '     - 或在 npm run build 之前设置 SESSION_SECRET=<随机值>（会被烘焙进产物）\n'
      + '     （Docker: -e NUXT_SESSION_PASSWORD=xxx / PM2: ecosystem env / .env 写 NUXT_SESSION_PASSWORD）\n'
      + '  3) 重新构建并启动服务\n'
      + '注意：更换密钥会使所有已登录会话失效，属预期行为。\n'
      + '============================================================\n'
  console.error(fatal)

  // 兜底：任何请求都返回 503，确保绝不以不安全配置对外提供服务
  nitroApp.hooks.hook('request', () => {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: '服务未正确配置（会话密钥不安全），已停止对外服务，请联系管理员',
    })
  })

  // 抛出后 Nitro 会 rethrow，node-server 进程退出
  throw new Error(`[CSMS][FATAL] 会话密钥配置不安全，已拒绝启动：${problems.join('；')}`)
})
