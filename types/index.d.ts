export type Usage = {
  percent: number | null
  tokens: number | null
  window: number
  fiveHour: { percent: number; resetsAt: string | null } | null
}

export type Git = {
  branch: string
  isDirty: boolean
  ahead: number
  behind: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-band': { usage: Usage | null; git: Git | null }
  }
}
