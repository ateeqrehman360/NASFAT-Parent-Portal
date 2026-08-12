'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
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
    <main className="nasfat-app" style={S.page}>

      <div style={S.content}>
        <header className="nasfat-surface nasfat-enter" style={S.header}>
          <div style={S.headerCopy}>
            <div style={S.eyebrow}>NASFAT Manchester</div>
            <h1 data-heading="true" style={S.headerTitle}>Admin dashboard</h1>
            <div data-body="true" style={S.headerSub}>Log points and manage the madrasa in one place.</div>
          </div>
          <div style={S.headerActions}>
            <Image className="nasfat-logo" src="/nasfat-logo.png" alt="NASFAT Manchester" width={44} height={44} priority style={S.headerLogo} />
            <button
              className="nasfat-button"
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              style={S.logoutBtn}
            >
              Log out
            </button>
          </div>
        </header>

        {loading ? (
          <div className="nasfat-surface nasfat-enter" style={S.card} aria-label="Loading dashboard">
            <div className="nasfat-skeleton" style={{ width: 112, height: 20 }}>Loading</div>
            <div className="nasfat-skeleton" style={{ width: '72%', height: 13, marginTop: 10 }}>Loading</div>
            <div style={S.classGrid}>
              {[0, 1, 2, 3].map((item) => <div className="nasfat-skeleton" key={item} style={{ height: 66 }}>Loading</div>)}
            </div>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="nasfat-status" role="alert" style={S.errorCard}>
                <b>Something went wrong:</b> {errorMsg}
              </div>
            )}

            <section className="nasfat-surface nasfat-enter" style={S.card} aria-labelledby="class-points-heading">
              <div style={S.cardHeader}>
                <div>
                  <h2 id="class-points-heading" style={S.cardTitle}>Today’s classes</h2>
                  <div data-body="true" style={S.cardHint}>Choose a group to open the points screen.</div>
                </div>
                <span className="nasfat-number" style={S.countPill}>{classes.length} {classes.length === 1 ? 'group' : 'groups'}</span>
              </div>

              {classes.length === 0 ? (
                <div style={S.emptyState}>
                  No classes yet. Create your first class in Class management below.
                </div>
              ) : (
                <div style={S.classGrid}>
                  {classes.map((c, index) => (
                    <button
                      className="nasfat-button nasfat-tile nasfat-stagger"
                      key={c.id}
                      type="button"
                      onClick={() => router.push(`/admin/classes/${c.id}`)}
                      style={S.classRow}
                      aria-label={`Open ${c.name} points`}
                    >
                      <span style={S.rowLead}><span aria-hidden="true" style={S.classBadge}>{String(index + 1).padStart(2, '0')}</span><span><span style={S.rowTitle}>{c.name}</span><span style={S.rowSubtitle}>Log today’s points</span></span></span>
                      <span style={S.chev}>→</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="nasfat-surface nasfat-enter" style={{ ...S.card, ...S.managementCard }} aria-labelledby="management-heading">
              <div style={S.sectionKicker}>Management</div>
              <h2 id="management-heading" style={S.cardTitle}>Madrasa records</h2>
              <div data-body="true" style={S.cardHint}>Students, family access, groups, attendance, and exam results.</div>
              <div style={S.classGrid}>
                <ManagementLink badge="ST" label="Students" description="Names, classes & archive" onClick={() => router.push('/admin/students')} style={S} />
                <ManagementLink badge="PA" label="Parents" description="Accounts & student links" onClick={() => router.push('/admin/parents')} style={S} />
                <ManagementLink badge="CL" label="Classes" description="Create & rename groups" onClick={() => router.push('/admin/classes/manage')} style={S} />
                <ManagementLink badge="AT" label="Attendance" description="Saturday class register" onClick={() => router.push('/admin/attendance')} style={S} />
                <ManagementLink badge="EX" label="Exam results" description="Enter & update scores" onClick={() => router.push('/admin/exams')} style={S} />
              </div>
            </section>
          </>
        )}
      </div>

    </main>
  )
}

function ManagementLink({ badge, label, description, onClick, style }: { badge: string; label: string; description: string; onClick: () => void; style: Record<string, CSSProperties> }) {
  return <button className="nasfat-button nasfat-tile nasfat-stagger" type="button" onClick={onClick} style={style.classRow}>
    <span style={style.rowLead}><span aria-hidden="true" style={style.managementBadge}>{badge}</span><span><span style={style.rowTitle}>{label}</span><span style={style.rowSubtitle}>{description}</span></span></span>
    <span aria-hidden="true" style={style.chev}>→</span>
  </button>
}

const styles = (isMobile: boolean): Record<string, CSSProperties> => ({
  page: {
    position: 'relative',
    minHeight: '100dvh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    color: '#111827',
    overflowX: 'hidden',
  },

  content: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 820,
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: isMobile ? '12px 12px max(40px, env(safe-area-inset-bottom))' : '24px 24px 48px',
  },

  header: {
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(203, 213, 225, 0.76)',
    borderRadius: isMobile ? 22 : 26,
    padding: isMobile ? 15 : 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'nowrap',
    boxShadow: '0 14px 38px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
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
    margin: 0,
    fontSize: isMobile ? 21 : 26,
    fontWeight: 900,
    color: '#1F3A5F',
    lineHeight: 1.08,
    letterSpacing: '-0.025em',
  },

  eyebrow: {
    marginBottom: 6,
    color: '#4E83A5',
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  headerSub: {
    marginTop: 6,
    fontSize: 13,
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
    marginTop: 16,
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid rgba(203, 213, 225, 0.72)',
    borderRadius: isMobile ? 22 : 26,
    padding: isMobile ? 16 : 20,
    color: '#111827',
    boxShadow: '0 14px 38px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },

  managementCard: {
    background: 'linear-gradient(145deg, rgba(234, 244, 251, 0.94), rgba(255, 255, 255, 0.94))',
    border: '1px solid rgba(207, 230, 246, 0.95)',
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: '#1F3A5F',
  },

  cardHint: {
    marginTop: 5,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: 700,
  },

  classGrid: {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: 11,
    marginTop: 14,
  },

  classRow: {
    width: '100%',
    textAlign: 'left' as const,
    background: '#FFFFFF',
    border: '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: 16,
    padding: '12px 13px',
    minHeight: 68,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 900,
    color: '#111827',
    boxShadow: '0 3px 10px rgba(31, 58, 95, 0.045)',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  countPill: {
    flexShrink: 0,
    padding: '6px 10px',
    borderRadius: 999,
    background: '#EAF4FB',
    border: '1px solid #CFE6F6',
    color: '#1F3A5F',
    fontSize: 12,
    fontWeight: 900,
  },

  emptyState: {
    marginTop: 14,
    padding: 14,
    borderRadius: 15,
    background: '#F8FAFC',
    border: '1px dashed #CBD5E1',
    color: '#64748B',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.45,
  },

  rowLead: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },

  rowTitle: {
    display: 'block',
    color: '#1F3A5F',
    fontWeight: 900,
    lineHeight: 1.2,
  },

  rowSubtitle: {
    display: 'block',
    marginTop: 4,
    color: '#64748B',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.2,
  },

  classBadge: {
    width: 38,
    height: 38,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 12,
    background: '#EAF4FB',
    border: '1px solid #CFE6F6',
    color: '#1F3A5F',
    fontSize: 11,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },

  managementBadge: {
    width: 38,
    height: 38,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 12,
    background: '#1F3A5F',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.03em',
    boxShadow: '0 6px 13px rgba(31, 58, 95, 0.2)',
  },

  sectionKicker: {
    marginBottom: 6,
    color: '#4E83A5',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
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
