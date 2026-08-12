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
              <h2 id="management-heading" style={S.cardTitle}>Management</h2>
              <div data-body="true" style={S.cardHint}>Students, parents, staff, groups, attendance, and exam results.</div>
              <div style={S.classGrid}>
                <ManagementLink label="Students" description="Names, groups, and archive" onClick={() => router.push('/admin/students')} style={S} />
                <ManagementLink label="Parents" description="Accounts and student links" onClick={() => router.push('/admin/parents')} style={S} />
                <ManagementLink label="Staff" description="Accounts and access" onClick={() => router.push('/admin/staff')} style={S} />
                <ManagementLink label="Classes" description="Create and rename groups" onClick={() => router.push('/admin/classes/manage')} style={S} />
                <ManagementLink label="Attendance" description="Saturday class register" onClick={() => router.push('/admin/attendance')} style={S} />
                <ManagementLink label="Exam results" description="Enter and update scores" onClick={() => router.push('/admin/exams')} style={S} />
              </div>
            </section>
          </>
        )}
      </div>

    </main>
  )
}

function ManagementLink({ label, description, onClick, style }: { label: string; description: string; onClick: () => void; style: Record<string, CSSProperties> }) {
  return <button className="nasfat-button nasfat-tile nasfat-stagger" type="button" onClick={onClick} style={style.classRow}>
    <span style={style.rowLead}><span><span style={style.rowTitle}>{label}</span><span style={style.rowSubtitle}>{description}</span></span></span>
    <span aria-hidden="true" style={style.chev}>→</span>
  </button>
}

const styles = (isMobile: boolean): Record<string, CSSProperties> => ({
  page: {
    position: 'relative',
    minHeight: '100dvh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    color: '#1D2939',
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
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(186, 203, 218, 0.82)',
    borderRadius: 20,
    padding: isMobile ? 15 : 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'nowrap',
    boxShadow: '0 7px 20px rgba(31, 58, 95, 0.06)',
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
    fontWeight: 800,
    color: '#1F3A5F',
    lineHeight: 1.08,
    letterSpacing: '-0.025em',
  },

  headerSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#526277',
    fontWeight: 500,
    lineHeight: 1.45,
  },

  logoutBtn: {
    background: '#FFFFFF',
    border: '1px solid #B9C8D7',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 800,
    color: '#1F3A5F',
    minHeight: 44,
  },

  card: {
    marginTop: 16,
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(186, 203, 218, 0.72)',
    borderRadius: 20,
    padding: isMobile ? 16 : 20,
    color: '#1D2939',
    boxShadow: '0 7px 20px rgba(31, 58, 95, 0.055)',
  },

  managementCard: {
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(186, 203, 218, 0.72)',
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#1F3A5F',
  },

  cardHint: {
    marginTop: 5,
    fontSize: 13,
    color: '#526277',
    fontWeight: 500,
    lineHeight: 1.45,
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
    border: '1px solid #D6E0EA',
    borderRadius: 14,
    padding: '12px 13px',
    minHeight: 68,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 800,
    color: '#1D2939',
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
    fontWeight: 800,
  },

  emptyState: {
    marginTop: 14,
    padding: 14,
    borderRadius: 15,
    background: '#F8FAFC',
    border: '1px dashed #CBD5E1',
    color: '#64748B',
    fontSize: 13,
    fontWeight: 500,
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
    fontWeight: 800,
    lineHeight: 1.2,
  },

  rowSubtitle: {
    display: 'block',
    marginTop: 4,
    color: '#526277',
    fontSize: 11,
    fontWeight: 500,
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
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },

  chev: {
    color: '#365F84',
    fontWeight: 800,
    fontSize: 18,
  },

  errorCard: {
    marginTop: 14,
    background: 'rgba(254, 242, 242, 0.92)',
    border: '1px solid rgba(254, 202, 202, 0.9)',
    borderRadius: 16,
    padding: 14,
    color: '#991B1B',
    fontWeight: 600,
  },
})
