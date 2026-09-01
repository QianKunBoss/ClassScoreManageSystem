// DELETE /api/v1/scores/:logId — 撤销一条积分记录
//
// scope: scores:revoke
//
// 撤销不是"删一行"，而是要把 users 上的 total/add/deduct/count 四列对称回滚。
// 这段逻辑在 score-service.revokeScoreLog 里，与内部撤销接口共用。

import { API_CODE, apiError, apiOk, defineApiV1Handler } from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'
import { withIdempotency } from '../../../utils/api-idempotency'
import { revokeScoreLog } from '../../../utils/score-service'

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'scores:revoke')

  const logId = Number(getRouterParam(event, 'logId'))
  if (!Number.isInteger(logId) || logId <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '积分记录 id 不合法')
  }

  const data = await withIdempotency({
    event,
    db: ctx.db,
    tokenId: ctx.token.id,
    endpoint: `DELETE /api/v1/scores/${logId}`,
    run: async () => {
      const revoked = await revokeScoreLog({ db: ctx.db, scope: ctx.scope, logId })
      return {
        logId,
        userId: revoked.userId,
        username: revoked.username,
        revokedScoreChange: revoked.scoreChange,
      }
    },
  })

  return apiOk(event, data, '积分记录已撤销')
})
