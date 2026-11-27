/**
 * Instagram message preview for banners. Instagram sends no notification PupChat can see, so
 * when its unread count goes up, PupChat asks Instagram's own web inbox endpoint (the same
 * request instagram.com makes, from inside the logged-in page) for the newest chat. You chose
 * this (it's Instagram's private web API). One request per new message, read-only: reading
 * the inbox doesn't mark anything as seen. Nothing is stored.
 */

/** Runs in the Instagram page. Returns the newest message someone else sent, or null. */
export const READ_IG_INBOX = `(async () => {
  try {
    const res = await fetch('/api/v1/direct_v2/inbox/?persistentBadging=true&folder=&limit=5&thread_message_limit=1', {
      credentials: 'include',
      headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }
    })
    if (!res.ok) return { error: res.status }
    const j = await res.json()
    const me = String(j.viewer?.pk ?? j.viewer?.pk_id ?? j.viewer?.id ?? '')
    for (const t of j.inbox?.threads ?? []) {
      const it = (t.items ?? [])[0]
      if (!it || String(it.user_id) === me) continue
      const users = t.users ?? []
      const u = users.find((x) => String(x.pk ?? x.pk_id ?? x.id) === String(it.user_id)) ?? users[0] ?? {}
      const sender = u.full_name || u.username || ''
      const kind = it.item_type
      const text =
        it.text ??
        ({ media: '📷 Photo', media_share: '📷 Shared a post', clip: '🎬 Reel', voice_media: '🎤 Voice message',
           animated_media: 'GIF', raven_media: '📷 Photo', like: '❤️', story_share: 'Shared a story',
           reel_share: 'Replied to your story', link: it.link?.text } [kind] ?? 'New message')
      return {
        sender,
        group: t.is_group ? (t.thread_title || '') : '',
        text: String(text).slice(0, 400),
        avatar: u.profile_pic_url || '',
        thread: String(t.thread_id || '')
      }
    }
    return null
  } catch (e) {
    return { error: String(e).slice(0, 120) }
  }
})()`

export interface IgPreview {
  sender: string
  group: string
  text: string
  avatar: string
  thread: string
}

export function isIgPreview(v: unknown): v is IgPreview {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return ['sender', 'group', 'text', 'avatar', 'thread'].every((k) => typeof o[k] === 'string')
}
