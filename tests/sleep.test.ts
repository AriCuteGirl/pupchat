import { expect, it } from 'vitest'
import { servicesToSleep } from '../src/main/sleep'

const min = 60_000
const slots = [
  { id: 'whatsapp', awake: true, lastUsed: 0 },
  { id: 'discord', awake: true, lastUsed: 25 * min },
  { id: 'telegram', awake: false, lastUsed: 0 },
  { id: 'instagram', awake: true, lastUsed: 0 }
]

it('sleeps awake platforms unused for the limit, never the active one', () => {
  expect(servicesToSleep(slots, 'instagram', 30 * min, 20)).toEqual(['whatsapp'])
  expect(servicesToSleep(slots, 'whatsapp', 50 * min, 20)).toEqual(['discord', 'instagram'])
})

it('is off when minutes <= 0', () => {
  expect(servicesToSleep(slots, 'x', 999 * min, 0)).toEqual([])
})
