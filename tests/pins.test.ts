import { describe, expect, it } from 'vitest'
import { moveWithin, nameFromTitle, validatePins } from '../src/shared/pins'
import { isChatUrl } from '../src/shared/services'

describe('isChatUrl', () => {
  it('knows chat addresses per platform', () => {
    expect(isChatUrl('discord', 'https://discord.com/channels/@me/123456')).toBe(true)
    expect(isChatUrl('discord', 'https://discord.com/channels/111/222')).toBe(true)
    expect(isChatUrl('discord', 'https://discord.com/channels/@me')).toBe(false)
    expect(isChatUrl('discord', 'https://evil.com/channels/@me/1')).toBe(false)
    expect(isChatUrl('telegram', 'https://web.telegram.org/a/#-100123')).toBe(true)
    expect(isChatUrl('messenger', 'https://www.messenger.com/e2ee/t/987/')).toBe(true)
    expect(isChatUrl('instagram', 'https://www.instagram.com/direct/t/555')).toBe(true)
    expect(isChatUrl('whatsapp', 'https://web.whatsapp.com/')).toBe(false)
  })
})

describe('validatePins', () => {
  const ok = (s: string, u: string): boolean => isChatUrl(s, u)
  it('drops bad entries, duplicates and unknown categories', () => {
    const p = validatePins(
      {
        categories: [
          { id: 'cat111aa', service: 'discord', name: 'MY HONEY', color: '#91D7E3' },
          { id: 'cat111aa', name: 'dup' },
          { id: 'x', name: 'bad id' }
        ],
        items: [
          { id: 'pin111aa', service: 'discord', url: 'https://discord.com/channels/@me/1', name: ' Honey ', category: 'cat111aa' },
          { id: 'pin222bb', service: 'discord', url: 'https://discord.com/channels/@me/1', name: 'same url' },
          { id: 'pin333cc', service: 'discord', url: 'https://evil.com/x', name: 'evil' },
          { id: 'pin444dd', service: 'discord', url: 'https://discord.com/channels/@me/2', category: 'nope', avatar: 'javascript:1' },
          { id: 'pin555ee', service: 'instagram', url: 'https://www.instagram.com/direct/t/9', category: 'cat111aa' }
        ]
      },
      ok
    )
    // Old files had a per-platform `service`; categories are global now.
    expect(p.categories).toEqual([{ id: 'cat111aa', name: 'MY HONEY', color: '#91d7e3', collapsed: false }])
    expect(p.items.map((i) => [i.id, i.name, i.category, i.avatar])).toEqual([
      ['pin111aa', 'Honey', 'cat111aa', ''],
      ['pin444dd', 'Chat', '', ''],
      ['pin555ee', 'Chat', 'cat111aa', '']
    ])
  })
  it('handles garbage', () => {
    expect(validatePins(null, ok)).toEqual({ categories: [], items: [] })
  })
})

describe('helpers', () => {
  it('reads a chat name from page titles', () => {
    expect(nameFromTitle('(2) Discord | @mia', 'Discord')).toBe('mia')
    expect(nameFromTitle('• Discord | #general | Gamer Squad', 'Discord')).toBe('#general')
    expect(nameFromTitle('Instagram • Chats', 'Instagram')).toBe('')
    expect(nameFromTitle('Mia | Messenger', 'Messenger')).toBe('Mia')
  })
  it('moves within the same group only', () => {
    const l = [
      { id: 'a', g: 1 },
      { id: 'b', g: 2 },
      { id: 'c', g: 1 }
    ]
    moveWithin(l, 'c', -1, (x, y) => x.g === y.g)
    expect(l.map((x) => x.id)).toEqual(['c', 'b', 'a'])
    moveWithin(l, 'c', -1, (x, y) => x.g === y.g)
    expect(l.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
})
