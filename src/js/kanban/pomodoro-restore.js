export function resolveRestoredTimer(session, now) {
  if (session.pausedRemainingMs != null && session.pausedRemainingMs > 0) {
    return { mode: 'paused', remainingMs: session.pausedRemainingMs, endsAt: null };
  }

  if (session.endsAt != null && session.savedAt != null && session.endsAt > session.savedAt) {
    return { mode: 'paused', remainingMs: session.endsAt - session.savedAt, endsAt: null };
  }

  if (session.endsAt != null && session.endsAt > now && session.savedAt == null) {
    return { mode: 'running', remainingMs: session.endsAt - now, endsAt: session.endsAt };
  }

  return { mode: 'expired', remainingMs: 0, endsAt: session.endsAt || now };
}