import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Git, Usage } from '../types'
import { contextColor, formatClock, formatTokens, parseGitStatus } from './format'

const usage = atom({ plugin: 'session-band', key: 'usage' } as const, null)
const git = atom({ plugin: 'session-band', key: 'git' } as const, null)

const COMPACT_AT = 85
const WARN_CONTEXT_AT = 80
const WARN_RATE_AT = 90
const GIT_POLL_MS = 30_000
const TOUCHES_REPO = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

let hasWarnedContext = false
let hasWarnedRate = false
let isCompacting = false

async function refreshUsage($: EngineInterface) {
  const { context, rateLimits } = await $.session.usage()
  const five = rateLimits.find(r => r.kind === 'five_hour')
  const next: Usage = {
    percent: context.percent ?? null,
    tokens: context.tokens ?? null,
    window: context.window,
    fiveHour: five ? { percent: five.percentUsed, resetsAt: five.resetsAt ?? null } : null,
  }

  if (!same(next, await read($, usage))) {
    await update($, usage, () => next)
  }

  const percent = next.percent ?? 0

  if (percent >= WARN_CONTEXT_AT && !hasWarnedContext) {
    hasWarnedContext = true
    $.ui.toast(`Contexto em ${percent}%. Considere compactar.`)
  } else if (percent < 60) {
    hasWarnedContext = false
  }

  const rate = next.fiveHour?.percent ?? 0

  if (rate >= WARN_RATE_AT && !hasWarnedRate) {
    hasWarnedRate = true
    const at = next.fiveHour?.resetsAt ? formatClock(next.fiveHour.resetsAt) : null
    $.ui.toast(`Rate limit de 5h em ${rate}%${at ? `, reseta às ${at}` : ''}`)
  } else if (rate < WARN_RATE_AT) {
    hasWarnedRate = false
  }
}

async function refreshGit($: EngineInterface) {
  let next: Git | null = null

  try {
    const { exitCode, stdout } = await $.process.run(
      ['git', '--no-optional-locks', 'status', '--porcelain=v2', '--branch'],
      { timeoutMs: 5000 },
    )
    next = exitCode === 0 ? parseGitStatus(stdout) : null
  } catch {
    next = null
  }

  if (!same(next, await read($, git))) {
    await update($, git, () => next)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await Promise.all([refreshUsage($), refreshGit($)])
    $.clock.every(GIT_POLL_MS, () => {
      void refreshGit($)
    })

    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    await refreshUsage($)

    if (TOUCHES_REPO.has(e.tool)) {
      await refreshGit($)
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await Promise.all([refreshUsage($), refreshGit($)])

    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    await refreshUsage($)

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const u = await read($, usage)
    const g = await read($, git)
    const hasContext = u !== null && u.percent !== null
    const hasRate = u?.fiveHour != null

    if (!hasContext && !hasRate && g === null) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const sep = <Text dimColor> │ </Text>
    const parts = []

    if (u !== null && u.percent !== null) {
      parts.push(
        <Text key="ctx">
          <Text color={contextColor(u.percent)}>● </Text>
          <Text tabular>{u.percent}% contexto</Text>
          {u.tokens !== null ? (
            <Text dimColor tabular>
              {' '}
              {formatTokens(u.tokens)}/{formatTokens(u.window)}
            </Text>
          ) : null}
        </Text>,
      )
    }

    if (g !== null) {
      parts.push(
        <Text key="git" wrap="truncate-middle">
          <Text dimColor>⎇ </Text>
          {g.branch}
          {g.isDirty ? <Text color="warning">*</Text> : null}
          {g.ahead > 0 ? <Text dimColor> ↑{g.ahead}</Text> : null}
          {g.behind > 0 ? <Text dimColor> ↓{g.behind}</Text> : null}
        </Text>,
      )
    }

    if (u?.fiveHour != null) {
      const at = u.fiveHour.resetsAt ? formatClock(u.fiveHour.resetsAt) : null
      const color = u.fiveHour.percent >= WARN_RATE_AT ? 'error' : u.fiveHour.percent >= 70 ? 'warning' : undefined

      parts.push(
        <Text key="rate">
          <Text dimColor>5h </Text>
          <Text color={color} tabular>
            {u.fiveHour.percent}%
          </Text>
          {at ? <Text dimColor> · reset {at}</Text> : null}
        </Text>,
      )
    }

    const canCompact = hasContext && (u?.percent ?? 0) >= COMPACT_AT && !e.props.isWorking && !isCompacting

    return (
      <Box flexDirection="row" alignItems="center">
        <Text>
          {parts.flatMap((p, i) => (i === 0 ? [p] : [sep, p]))}
        </Text>
        {canCompact ? (
          <Box marginLeft={2}>
            <Button
              key="compact"
              label="Compactar"
              variant="primary"
              onPress={async () => {
                isCompacting = true
                try {
                  const r = await $.session.compact()
                  $.ui.toast(r.skip ? `Não compactou: ${r.skip}` : 'Contexto compactado')
                } finally {
                  isCompacting = false
                  await refreshUsage($)
                }
              }}
            />
          </Box>
        ) : null}
      </Box>
    )
  })
}
