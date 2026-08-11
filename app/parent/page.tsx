'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Student = {
  id: string
  first_name: string
  last_name: string | null
}

type PointRow = {
  student_id: string
  date: string
  points: number
}

function accountIsArchived(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return false
  const timestamp = Date.parse(bannedUntil)
  return Number.isNaN(timestamp) || timestamp > Date.now()
}

export default function ParentPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [todayMap, setTodayMap] = useState<Record<string, number | null>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

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

      if (accountIsArchived(user.banned_until)) {
        await supabase.auth.signOut()
        router.replace('/login')
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

      if (profile?.role !== 'parent') {
        router.push('/login')
        return
      }

      const { data: kids, error: kidsErr } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .order('first_name')

      if (kidsErr) {
        console.error(kidsErr)
        setErrorMsg(kidsErr.message)
        setLoading(false)
        return
      }

      const studentList = kids ?? []
      setStudents(studentList)

      if (studentList.length === 0) {
        setTotals({})
        setTodayMap({})
        setLoading(false)
        return
      }

      const ids = studentList.map((s) => s.id)

      const { data: rowsData, error: rowsErr } = await supabase
        .from('daily_points')
        .select('student_id, date, points')
        .in('student_id', ids)

      if (rowsErr) {
        console.error(rowsErr)
        setErrorMsg(rowsErr.message)
        setLoading(false)
        return
      }

      const rows = (rowsData ?? []) as PointRow[]

      // totals
      const t: Record<string, number> = {}
      for (const r of rows) t[r.student_id] = (t[r.student_id] ?? 0) + r.points
      setTotals(t)

      // today
      const tm: Record<string, number | null> = {}
      for (const id of ids) tm[id] = null
      for (const r of rows) if (r.date === todayISO) tm[r.student_id] = r.points
      setTodayMap(tm)

      setLoading(false)
    }

    init()
  }, [router, todayISO])

  const S = styles(isMobile)

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.content}>
          <div style={S.centerCard}>
            <p style={{ margin: 0, color: '#1F3A5F', fontWeight: 900 }}>Loading…</p>
            <p style={{ marginTop: 8, color: '#6B7280', fontSize: 13 }}>
              Please wait while we load your children’s points.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={S.page}>

      {/* ✅ Foreground content */}
      <div style={S.content}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div>
              <div style={S.headerTitle}>Madrasa Points</div>
              <div style={S.headerSub}>Parent View</div>
            </div>
          </div>

          <div style={S.headerRight}>
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

        <div style={S.topInfoCard}>
          <div>
            <div style={S.mutedLabel}>Today</div>
            <div style={S.todayBig}>{todayISO}</div>
          </div>

          <div style={S.tipBox}>
            <div style={{ fontWeight: 900, color: '#1F3A5F' }}>Tip</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6B7280' }}>
              If it says <b>Not updated yet</b>, the teacher hasn’t saved today’s points.
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={S.errorCard}>
            <b>Something went wrong:</b> {errorMsg}
          </div>
        )}

        {students.length === 0 ? (
          <div style={S.centerCard}>
            <p style={{ margin: 0, fontWeight: 900, color: '#1F3A5F' }}>No children linked</p>
            <p style={{ marginTop: 8, color: '#6B7280', fontSize: 13 }}>
              Please contact the madrasa admin to link your account to your child(ren).
            </p>
          </div>
        ) : (
          <div style={S.grid}>
            {students.map((s) => {
              const name = `${s.first_name}${s.last_name ? ` ${s.last_name}` : ''}`
              const todayVal = todayMap[s.id]
              const totalVal = totals[s.id] ?? 0

              return (
                <div key={s.id} style={S.childCard}>
                  <div style={S.childHeader}>
                    <div>
                      <div style={S.childName}>{name}</div>
                      <div style={S.childMeta}>Madrasa behaviour points</div>
                    </div>

                    <div style={todayVal === null ? S.badgePending : S.badgeUpdated}>
                      {todayVal === null ? 'Not updated yet' : 'Updated'}
                    </div>
                  </div>

                  <div style={S.metricsRow}>
                    <div style={S.metricBox}>
                      <div style={S.metricLabel}>Today</div>
                      <div style={S.metricValue}>{todayVal === null ? '—' : todayVal}</div>
                    </div>

                    <div style={S.metricBox}>
                      <div style={S.metricLabel}>Total</div>
                      <div style={S.metricValue}>{totalVal}</div>
                    </div>
                  </div>

                  <div style={S.footerNote}>Points reflect behaviour and effort in class.</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

const styles = (isMobile: boolean): Record<string, React.CSSProperties> => ({
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    color: '#111827',
    overflow: 'hidden',
  },

  content: {
    padding: isMobile ? 14 : 24,
  },

  header: {
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(229, 231, 235, 0.8)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  headerTitle: {
    fontSize: isMobile ? 16 : 18,
    fontWeight: 900,
    color: '#1F3A5F',
    lineHeight: 1.1,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 600,
  },
  headerLeft: {
    minWidth: 0,
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  headerLogo: {
    width: isMobile ? 38 : 44,
    height: 'auto',
    opacity: 0.95,
    flexShrink: 0,
  },
  logoutBtn: {
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 14,
    padding: '12px 16px', // ⬅ bigger
    cursor: 'pointer',
    fontWeight: 900,
    color: '#1F3A5F',
    minHeight: 44, // ⬅ mobile accessibility
  },

  topInfoCard: {
    marginTop: 14,
    background: 'rgba(234, 244, 251, 0.88)',
    border: '1px solid rgba(207, 230, 246, 0.85)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 12,
    flexWrap: 'wrap',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  mutedLabel: {
    fontSize: 12,
    color: '#1F3A5F',
    opacity: 0.75,
    fontWeight: 900,
  },
  todayBig: {
    fontSize: isMobile ? 20 : 22,
    fontWeight: 900,
    color: '#1F3A5F',
    marginTop: 2,
  },
  tipBox: {
    background: 'rgba(255, 255, 255, 0.86)',
    border: '1px solid rgba(207, 230, 246, 0.85)',
    borderRadius: 14,
    padding: 12,
    maxWidth: isMobile ? '100%' : 420,
    width: isMobile ? '100%' : undefined,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
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

  centerCard: {
    marginTop: 18,
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(229, 231, 235, 0.8)',
    borderRadius: 16,
    padding: 18,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },

  grid: {
    marginTop: 16,
    display: 'grid',
    gap: 14,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
  },

  childCard: {
    background: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 20,
    padding: isMobile ? 16 : 18,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',

    // elevation
    boxShadow: `
      0 8px 24px rgba(31, 58, 95, 0.08),
      0 2px 6px rgba(31, 58, 95, 0.06)
    `,

    // tap feel
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  childHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  childName: {
    fontSize: 18,
    fontWeight: 900,
    color: '#1F3A5F',
  },
  childMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 600,
  },

  badgePending: {
    background: '#F3F4F6',
    border: '1px solid #E5E7EB',
    color: '#374151',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  badgeUpdated: {
    background: '#EAF4FB',
    border: '1px solid #CFE6F6',
    color: '#1F3A5F',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },

  metricsRow: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  metricBox: {
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    boxShadow: '0 4px 12px rgba(31, 58, 95, 0.08)',
  },

  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 900,
  },

  metricValue: {
    marginTop: 6,
    fontSize: isMobile ? 26 : 28,
    fontWeight: 900,
    color: '#1F3A5F',
    letterSpacing: -0.5,
  },

  footerNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
  },
})
