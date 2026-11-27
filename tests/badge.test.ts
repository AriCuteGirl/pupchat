import { describe, expect, it } from 'vitest'
import { badgeLabel, parseUnread, totalUnread, unreadFor, unreadGrowth } from '../src/main/badge'

describe('parseUnread', () => {
  it('reads a leading count', () => {
    expect(parseUnread('(3) WhatsApp')).toBe(3)
    expect(parseUnread('(12+) Instagram • Chats')).toBe(12)
    expect(parseUnread('(1) Discord | #general | Server')).toBe(1)
  })
  it('reads a trailing count', () => {
    expect(parseUnread('Telegram (7)')).toBe(7)
  })
  it('treats a leading bullet as unread without a count', () => {
    expect(parseUnread('• Discord | #memes')).toBe('dot')
    expect(parseUnread('● Messenger')).toBe('dot')
  })
  it('returns 0 for plain titles and look-alikes', () => {
    expect(parseUnread('WhatsApp')).toBe(0)
    expect(parseUnread('Messenger')).toBe(0)
    expect(parseUnread('Chat about (3) things')).toBe(0)
    expect(parseUnread('')).toBe(0)
    expect(parseUnread('(abc) Discord')).toBe(0)
  })
})

describe('totalUnread / badgeLabel', () => {
  it('sums counts and dots', () => {
    expect(totalUnread([3, 'dot', 0, 2])).toBe(6)
    expect(totalUnread([])).toBe(0)
  })
  it('caps the label', () => {
    expect(badgeLabel(5)).toBe('5')
    expect(badgeLabel(150)).toBe('99+')
    expect(badgeLabel('dot')).toBe('')
  })
})

describe('unreadFor', () => {
  it('ignores the bare dot when asked (Discord server activity), keeps numbers', () => {
    expect(unreadFor('• Discord | #general', true)).toBe(0)
    expect(unreadFor('(2) Discord | Friends', true)).toBe(2)
    expect(unreadFor('• Messenger', false)).toBe('dot')
  })
})

describe('unreadGrowth', () => {
  it('counts only increases', () => {
    expect(unreadGrowth(0, 1)).toBe(1)
    expect(unreadGrowth(2, 5)).toBe(3)
    expect(unreadGrowth(5, 2)).toBe(0)
    expect(unreadGrowth(0, 'dot')).toBe(1)
    expect(unreadGrowth('dot', 'dot')).toBe(0)
    expect(unreadGrowth(3, 0)).toBe(0)
  })
})
