'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type ClassRow = {
  id: string
  name: string
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const init = async () => {
      setErrorMsg(null)

      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) {
        console.error(userErr)
        setErrorMsg(userErr.message)
        setLoading(false)
        return
      }

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileErr) {
        console.error(profileErr)
        setErrorMsg(profileErr.message)
        setLoading(false)
        return
      }

      if (profile?.role !== 'admin') {
        router.push('/login')
        return
      }

      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (clsErr) {
        console.error(clsErr)
        setErrorMsg('Could not load classes (check Supabase policies/grants).')
      } else {
        setClasses(cls ?? [])
      }

      setLoading(false)
    }

    init()
  }, [router])

  const S = styles(isMobile)

  return (
    <main style={S.page}>

      <div style={S.content}>
        <div style={S.header}>
          <div style={S.headerCopy}>
            <div style={S.headerTitle}>Admin</div>
            <div style={S.headerSub}>Choose a class to log today’s points</div>
          </div>
          <div style={S.headerActions}>
            <img src="/nasfat-logo.png" alt="NASFAT Manchester" style={S.headerLogo} />
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              style={S.logoutBtn}
            >
              Log out
            </button>
          </div>
        </div>

        {loading ? (
          <div style={S.card}>Loading…</div>
        ) : (
          <>
            {errorMsg && (
              <div style={S.errorCard}>
                <b>Something went wrong:</b> {errorMsg}
              </div>
            )}

            <div style={S.card}>
              <div style={S.cardTitle}>Classes</div>
              <div style={S.cardHint}>Tap a class to open the points screen.</div>

              {classes.length === 0 ? (
                <p style={{ marginTop: 12, color: '#6B7280', fontWeight: 600 }}>
                  No classes yet. Create your first class in Class management below.
                </p>
              ) : (
                <div style={S.classGrid}>
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/admin/classes/${c.id}`)}
                      style={S.classRow}
                    >
                      <span style={{ fontWeight: 900 }}>{c.name}</span>
                      <span style={S.chev}>→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...S.card, ...S.managementCard }}>
              <div style={S.cardTitle}>Management</div>
              <div style={S.cardHint}>Manage students, parent accounts, and classes.</div>
              <div style={S.classGrid}>
                <button onClick={() => router.push('/admin/students')} style={S.classRow}><span style={{ fontWeight: 900 }}>Students</span><span style={S.chev}>→</span></button>
                <button onClick={() => router.push('/admin/parents')} style={S.classRow}><span style={{ fontWeight: 900 }}>Parents</span><span style={S.chev}>→</span></button>
                <button onClick={() => router.push('/admin/classes/manage')} style={S.classRow}><span style={{ fontWeight: 900 }}>Classes</span><span style={S.chev}>→</span></button>
              </div>
            </div>
          </>
        )}
      </div>

    </main>
  )
}

const styles = (isMobile: boolean): Record<string, CSSProperties> => ({
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    color: '#111827',
    overflow: 'hidden',
  },

  content: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 820,
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: isMobile ? '14px 14px 36px' : '24px 24px 44px',
  },

  // EXACT match to classId header
  header: {
    background: 'rgba(255, 255, 255, 0.90)',
    border: '1px solid rgba(229, 231, 235, 0.75)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'nowrap',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  headerCopy: {
    minWidth: 0,
    flex: 1,
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 8 : 12,
    flexShrink: 0,
  },

  headerLogo: {
    width: isMobile ? 38 : 44,
    height: 'auto',
    flexShrink: 0,
  },

  headerTitle: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: 900,
    color: '#1F3A5F',
    lineHeight: 1.1,
  },

  headerSub: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  logoutBtn: {
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 900,
    color: '#1F3A5F',
    minHeight: 44,
  },

  card: {
    marginTop: 14,
    background: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 18,
    padding: isMobile ? 14 : 16,
    color: '#111827',

    // Elevation instead of border
    boxShadow: isMobile
      ? '0 8px 24px rgba(15, 23, 42, 0.10)'
      : '0 10px 30px rgba(15, 23, 42, 0.08)',

    // Keep glass effect
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  managementCard: {
    background: 'rgba(234, 244, 251, 0.86)',
    border: '1px solid rgba(207, 230, 246, 0.95)',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1F3A5F',
  },

  cardHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  classGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    marginTop: 14,
  },

  classRow: {
    width: '100%',
    textAlign: 'left' as const,
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 14,
    padding: '14px 14px',
    minHeight: 58,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 900,
    color: '#111827',
  },

  chev: {
    color: '#4DA3D9',
    fontWeight: 900,
    fontSize: 18,
  },

  errorCard: {
    marginTop: 14,
    background: 'rgba(254, 242, 242, 0.92)',
    border: '1px solid rgba(254, 202, 202, 0.9)',
    borderRadius: 16,
    padding: 14,
    color: '#991B1B',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
})
