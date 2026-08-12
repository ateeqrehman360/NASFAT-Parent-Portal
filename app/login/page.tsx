'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
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

  const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date()), [])

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
    <main className="nasfat-app" style={S.page} aria-label="Login page">
      <div style={S.content}>
        <div style={S.headerWrap}>
          <Image
            className="nasfat-logo"
            src="/nasfat-logo.png"
            alt="NASFAT Manchester"
            width={110}
            height={110}
            priority
            style={S.logo}
          />
        </div>

        <div className="nasfat-surface nasfat-enter" style={S.card}>
          <div style={S.top}>
            <div>
              <div style={S.eyebrow}>NASFAT Manchester</div>
              <h1 data-heading="true" style={S.title}>Parent Portal</h1>
              <div data-body="true" style={S.subTitle}>Welcome back. Sign in to continue.</div>
            </div>

            <div style={S.metaRight} aria-label="Today">
              <div style={S.metaLabel}>Today</div>
              <div className="nasfat-number" style={S.metaValue}>{todayLabel}</div>
            </div>
          </div>

          {netHint && <div className="nasfat-status" role="status" style={S.netCard}>{netHint}</div>}

          {msg && (
            <div className="nasfat-status" style={S.errorCard} role="alert" aria-live="polite">
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
              name="username"
              style={S.input}
              type="text"
              autoComplete="username"
              placeholder="e.g. abdullah123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={Boolean(msg)}
              required
            />

            <label style={{ ...S.label, marginTop: 12 }} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
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
              aria-invalid={Boolean(msg)}
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
              className="nasfat-button"
              type="submit"
              disabled={loading}
              style={{ ...S.primaryBtn, ...(loading ? S.primaryBtnDisabled : {}) }}
              aria-busy={loading}
            >
              {loading ? <><span className="nasfat-spinner" aria-hidden="true" />Signing in…</> : 'Sign in'}
            </button>

            <div style={S.note}>
              You’ll stay signed in on this device.
              <br />
              If you forgot your login, contact the madrasa admin.
            </div>
          </form>
        </div>

        <div className="nasfat-enter" style={S.footer}>NASFAT Manchester • Madrasa</div>
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
    minHeight: '100dvh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    overflowX: 'hidden',
  },

  headerWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: isMobile ? 12 : 18,
  },
  
  logo: {
    width: isMobile ? 84 : 104,
    height: 'auto',
    opacity: 1,
  },

  content: {
    width: '100%',
    maxWidth: 510,
    margin: '0 auto',
    padding: isMobile ? '20px 14px max(20px, env(safe-area-inset-bottom))' : 28,
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 14,
  },

  card: {
    background: 'rgba(255, 255, 255, 0.93)',
    border: '1px solid rgba(203, 213, 225, 0.76)',
    borderRadius: isMobile ? 24 : 28,
    padding: isMobile ? 18 : 24,
    boxShadow: '0 22px 60px rgba(31, 58, 95, 0.14)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },

  top: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    margin: 0,
    fontSize: isMobile ? 20 : 22,
    fontWeight: 900,
    color: '#1F3A5F',
    letterSpacing: -0.5,
    lineHeight: 1.1,
  },

  eyebrow: {
    marginBottom: 6,
    color: '#4E83A5',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  subTitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: 700,
  },

  metaRight: {
    textAlign: 'right' as const,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(207, 230, 246, 0.85)',
    background: 'rgba(234, 244, 251, 0.80)',
    minWidth: isMobile ? 108 : 126,
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
    fontSize: 13,
    color: '#1F3A5F',
    fontWeight: 900,
    marginBottom: 6,
  },

  input: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    border: '1px solid rgba(209, 213, 219, 1)',
    background: '#FFFFFF',
    padding: '12px 14px',
    fontSize: 16,
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
    minHeight: 44,
    cursor: 'pointer',
    userSelect: 'none',
  },

  checkbox: {
    width: 20,
    height: 20,
    accentColor: '#1F3A5F',
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
    background: 'linear-gradient(180deg, #294B74 0%, #1F3A5F 100%)',
    color: '#FFFFFF',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: 16,
    minHeight: 48,
    boxShadow: '0 10px 22px rgba(31, 58, 95, 0.24)',
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
    opacity: 0.82,
    letterSpacing: '0.02em',
  },
})
