'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [capsOn, setCapsOn] = useState(false)
  const [netHint, setNetHint] = useState<string | null>(null)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const usernameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    // autofocus username (mobile-friendly)
    usernameRef.current?.focus()
  }, [])

  useEffect(() => {
    // simple online/offline hint
    const onOnline = () => setNetHint(null)
    const onOffline = () => setNetHint('You appear to be offline. Check your internet connection.')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (typeof navigator !== 'undefined' && !navigator.onLine) onOffline()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const S = styles(isMobile)

  const normalizeAuthError = (raw: string) => {
    const s = raw.toLowerCase()
    if (s.includes('invalid login credentials')) return 'Username or password is incorrect.'
    if (s.includes('banned')) return 'This account has been archived. Please contact the madrasa admin.'
    if (s.includes('username not confirmed')) return 'Your account is not confirmed yet. Please contact the madrasa admin.'
    if (s.includes('too many requests')) return 'Too many attempts. Please wait a moment and try again.'
    return raw
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setNetHint(null)
    setLoading(true)

    const cleanUsername = username.trim().toLowerCase()

    // 1) Look up email from username
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', cleanUsername)
      .single()

    if (profErr || !prof?.email) {
      setMsg('Username or password is incorrect.')
      setLoading(false)
      return
    }

    // 2) Sign in using the email we found
    const { data, error } = await supabase.auth.signInWithPassword({
      email: prof.email,
      password,
    })

    setLoading(false)

    if (error) {
      setMsg(normalizeAuthError(error.message))
      return
    }

    const user = data.user
    if (!user) {
      setMsg('Could not sign in. Please try again.')
      return
    }

    const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : null
    if (bannedUntil !== null && (Number.isNaN(bannedUntil) || bannedUntil > Date.now())) {
      await supabase.auth.signOut()
      setMsg('This account has been archived. Please contact the madrasa admin.')
      return
    }

    // 3) Route based on role (same as before)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      console.error(profileErr)
      setMsg('Signed in, but could not load your account role. Please try again.')
      return
    }

    if (profile?.role === 'admin') router.push('/admin')
    else if (profile?.role === 'staff') router.push('/admin/exams')
    else if (profile?.role === 'parent') router.push('/parent')
    else setMsg('Account role not set. Please contact the madrasah admin.')
  }

  return (
    <main style={S.page} aria-label="Login page">
      <div style={S.content}>

        {/* ✅ Logo at the top */}
        <div style={S.headerWrap}>
          <img
            src="/nasfat-logo.png"
            alt="NASFAT Manchester"
            style={S.logo}
          />
        </div>

        {/* ✅ Card unchanged */}
        <div style={S.card}>
          <div style={S.top}>
            <div>
              <div style={S.title}>Madrasa Points</div>
              <div style={S.subTitle}>Sign in</div>
            </div>

            <div style={S.metaRight} aria-label="Today">
              <div style={S.metaLabel}>Today</div>
              <div style={S.metaValue}>{todayISO}</div>
            </div>
          </div>

          {netHint && <div style={S.netCard}>{netHint}</div>}

          {msg && (
            <div style={S.errorCard} role="alert" aria-live="polite">
              {msg}
            </div>
          )}

          <form onSubmit={signIn} style={{ marginTop: 14 }} aria-busy={loading}>
            <label style={S.label} htmlFor="username">
              Username
            </label>
            <input
              ref={usernameRef}
              id="username"
              style={S.input}
              type="text"
              autoComplete="username"
              placeholder="e.g. abdullah123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <label style={{ ...S.label, marginTop: 12 }} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              style={S.input}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => {
                const caps = e.getModifierState?.('CapsLock')
                setCapsOn(Boolean(caps))
              }}
              required
            />

            <div style={S.row}>
              <label style={S.checkboxWrap}>
                <input
                  type="checkbox"
                  checked={showPw}
                  onChange={(e) => setShowPw(e.target.checked)}
                  style={S.checkbox}
                />
                <span style={S.checkboxText}>Show password</span>
              </label>

              {capsOn && <span style={S.capsWarn}>Caps Lock is on</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...S.primaryBtn, ...(loading ? S.primaryBtnDisabled : {}) }}
              aria-busy={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div style={S.note}>
              You’ll stay signed in on this device.
              <br />
              If you forgot your login, contact the madrasa admin.
            </div>
          </form>
        </div>

        <div style={S.footer}>NASFAT Manchester • Madrasa</div>
      </div>
      <style jsx global>{`
        input::placeholder {
          color: #9CA3AF;
        }
      `}</style>
    </main>
  )
}

const styles = (isMobile: boolean): Record<string, React.CSSProperties> => ({
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    overflow: 'hidden',
  },

  // ✅ NEW: logo at the top (no background watermark)
  headerWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: isMobile ? 12 : 18,
  },
  
  logo: {
    width: isMobile ? 90 : 110,
    height: 'auto',
    opacity: 1, // fully opaque
  },

  content: {
    padding: isMobile ? 14 : 24,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 14,
  },

  card: {
    marginTop: 14,
    background: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 18,
    padding: isMobile ? 14 : 16,

    // Elevation instead of border
    boxShadow: isMobile
      ? '0 8px 24px rgba(15, 23, 42, 0.10)'
      : '0 10px 30px rgba(15, 23, 42, 0.08)',

    // Keep glass effect
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  top: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    fontSize: isMobile ? 20 : 22,
    fontWeight: 900,
    color: '#1F3A5F',
    letterSpacing: -0.2,
  },

  subTitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  metaRight: {
    textAlign: 'right' as const,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(207, 230, 246, 0.85)',
    background: 'rgba(234, 244, 251, 0.80)',
    minWidth: 130,
  },

  metaLabel: {
    fontSize: 11,
    color: '#1F3A5F',
    opacity: 0.75,
    fontWeight: 900,
  },

  metaValue: {
    marginTop: 2,
    fontSize: 12,
    color: '#1F3A5F',
    fontWeight: 900,
  },

  netCard: {
    marginTop: 12,
    background: 'rgba(255, 251, 235, 0.92)',
    border: '1px solid rgba(252, 211, 77, 0.7)',
    borderRadius: 14,
    padding: 12,
    color: '#92400E',
    fontWeight: 800,
  },

  errorCard: {
    marginTop: 12,
    background: 'rgba(254, 242, 242, 0.92)',
    border: '1px solid rgba(254, 202, 202, 0.9)',
    borderRadius: 14,
    padding: 12,
    color: '#991B1B',
    fontWeight: 800,
  },

  label: {
    display: 'block',
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 900,
    marginBottom: 6,
  },

  input: {
    width: '100%',
    borderRadius: 14,
    border: '1px solid rgba(209, 213, 219, 1)',
    background: '#FFFFFF',
    padding: '12px 14px',
    fontSize: 16,
    outline: 'none',
    color: '#000000',
    caretColor: '#000000',
  },

  row: {
    marginTop: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },

  checkboxWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    userSelect: 'none',
  },

  checkbox: {
    width: 18,
    height: 18,
  },

  checkboxText: {
    fontSize: 13,
    color: '#1F3A5F',
    fontWeight: 900,
  },

  capsWarn: {
    fontSize: 12,
    fontWeight: 900,
    color: '#92400E',
    background: 'rgba(255, 251, 235, 0.92)',
    border: '1px solid rgba(252, 211, 77, 0.7)',
    padding: '6px 10px',
    borderRadius: 999,
  },

  primaryBtn: {
    width: '100%',
    marginTop: 14,
    borderRadius: 14,
    padding: '12px 14px',
    border: '1px solid rgba(15, 23, 42, 0.2)',
    background: '#1F3A5F',
    color: '#FFFFFF',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: 16,
    minHeight: 48,
  },

  primaryBtnDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },

  note: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 600,
    lineHeight: 1.4,
  },

  footer: {
    textAlign: 'center' as const,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
    opacity: 0.9,
  },
})
