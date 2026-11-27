export interface SleepCandidate {
  id: string
  awake: boolean
  /** ms timestamp of the last time you had this platform open. */
  lastUsed: number
}

/**
 * Which awake platforms to put to sleep (close their page to free RAM).
 * Never the one you're looking at. `minutes <= 0` turns sleeping off.
 */
export function servicesToSleep(
  slots: readonly SleepCandidate[],
  activeId: string,
  now: number,
  minutes: number
): string[] {
  if (minutes <= 0) return []
  const limit = minutes * 60_000
  return slots.filter((s) => s.awake && s.id !== activeId && now - s.lastUsed >= limit).map((s) => s.id)
}
