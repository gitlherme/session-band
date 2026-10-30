import type { Git } from '../types'

// `git status --porcelain=v2 --branch`: header lines start with `#`, every
// other line is a changed or untracked path.
export const parseGitStatus = (stdout: string): Git | null => {
  let branch: string | null = null
  let oid = ''
  let ahead = 0
  let behind = 0
  let isDirty = false

  for (const line of stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      branch = line.slice('# branch.head '.length).trim()
    } else if (line.startsWith('# branch.oid ')) {
      oid = line.slice('# branch.oid '.length).trim()
    } else if (line.startsWith('# branch.ab ')) {
      const [a, b] = line.slice('# branch.ab '.length).trim().split(' ')
      ahead = Math.abs(Number(a) || 0)
      behind = Math.abs(Number(b) || 0)
    } else if (line.trim() !== '' && !line.startsWith('#')) {
      isDirty = true
    }
  }

  if (branch === null) {
    return null
  }

  if (branch === '(detached)') {
    branch = oid === '(initial)' || oid === '' ? 'detached' : `@${oid.slice(0, 7)}`
  }

  return { branch, isDirty, ahead, behind }
}

export const formatTokens = (n: number): string => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }

  return `${Math.round(n / 1000)}k`
}

export const formatClock = (iso: string): string | null => {
  const at = new Date(iso)

  if (Number.isNaN(at.getTime())) {
    return null
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

export const contextColor = (percent: number) =>
  percent >= 85 ? 'error' : percent >= 60 ? 'warning' : 'success'
