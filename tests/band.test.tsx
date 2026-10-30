import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parseGitStatus } from '../hooks/format'

const band = (isWorking = false) =>
  ({
    plugin: 'session-band',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking,
      maxRows: 10,
      bodyColumns: 100,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  }) as const

const STATUS = [
  '# branch.oid 1234567890abcdef',
  '# branch.head feat/login',
  '# branch.upstream origin/feat/login',
  '# branch.ab +2 -1',
  '1 .M N... 100644 100644 100644 aaa bbb src/a.ts',
].join('\n')

test('parses branch, dirty flag and ahead/behind', () => {
  expect(parseGitStatus(STATUS)).toEqual({ branch: 'feat/login', isDirty: true, ahead: 2, behind: 1 })
  expect(parseGitStatus('# branch.oid abcdef1234\n# branch.head (detached)\n')).toEqual({
    branch: '@abcdef1',
    isDirty: false,
    ahead: 0,
    behind: 0,
  })
})

const engine = (on: On, percent: number) => {
  mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: percent * 2000, window: 200_000, percent },
      rateLimits: [{ kind: 'five_hour', percentUsed: 31, resetsAt: '2026-10-30T14:20:00' }],
    },
  }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: STATUS, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('ui.toast', () => ({ value: undefined }))
}

test('the band shows context, branch and 5h rate limit on every surface', async ($, on) => {
  engine(on, 42)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...band(), surface })

    expect((await ui.find({ type: 'Text', text: /42% contexto/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /84k\/200k/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /feat\/login/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /31%/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /reset 14:20/ }))).toBeTruthy()
    expect(await ui.find({ type: 'Button', key: 'compact' })).toBeFalsy()
    await ui.unmount()
  }
})

test('a compact button appears at 85% and hides while a turn runs', async ($, on) => {
  engine(on, 90)
  let compacted = 0
  on('session.compact', () => {
    compacted += 1
    return { skip: 'nothing to compact in a test' }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const working = await $.ui.mount({ ...band(true), surface: 'desktop' })
  expect(await working.find({ type: 'Button', key: 'compact' })).toBeFalsy()
  await working.unmount()

  const ui = await $.ui.mount({ ...band(), surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'compact' })).toBeTruthy()
  await ui.press({ key: 'compact' })
  expect(compacted).toBe(1)
  await ui.unmount()
})
