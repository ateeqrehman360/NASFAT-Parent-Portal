'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
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

type ExamResult = {
  id: string
  student_id: string
  exam_date: string | null
  quran_score: number | string | null
  quran_max_score: number | string | null
  islamic_studies_score: number | string | null
  islamic_studies_max_score: number | string | null
  arabic_score: number | string | null
  arabic_max_score: number | string | null
  updated_at: string
}

function accountIsArchived(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return false
  const timestamp = Date.parse(bannedUntil)
  return Number.isNaN(timestamp) || timestamp > Date.now()
}

function formatExamMonth(date: string | null) {
  if (!date) return 'Month not recorded'
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(parsed)
}

function formatScore(score: number | string | null, maxScore: number | string | null) {
  if (score === null) return '—'
  return maxScore === null ? String(score) : `${score}/${maxScore}`
}

function compareExamResults(a: ExamResult, b: ExamResult) {
  if (a.exam_date && b.exam_date) {
    const dateDifference = b.exam_date.localeCompare(a.exam_date)
    if (dateDifference !== 0) return dateDifference
  } else if (a.exam_date) {
    return -1
  } else if (b.exam_date) {
    return 1
  }

  return b.updated_at.localeCompare(a.updated_at)
}

export default function ParentPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [todayMap, setTodayMap] = useState<Record<string, number | null>>({})
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [examHistoryOpen, setExamHistoryOpen] = useState<Record<string, boolean>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date()), [])

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
        setExamResults([])
        setLoading(false)
        return
      }

      const ids = studentList.map((s) => s.id)

      const [{ data: rowsData, error: rowsErr }, { data: examData, error: examErr }] = await Promise.all([
        supabase
          .from('daily_points')
          .select('student_id, date, points')
          .in('student_id', ids),
        supabase
          .from('exam_results')
          .select('id, student_id, exam_date, quran_score, quran_max_score, islamic_studies_score, islamic_studies_max_score, arabic_score, arabic_max_score, updated_at')
          .in('student_id', ids)
          .order('exam_date', { ascending: false })
          .order('updated_at', { ascending: false }),
      ])

      if (rowsErr) {
        console.error(rowsErr)
        setErrorMsg(rowsErr.message)
        setLoading(false)
        return
      }

      const rows = (rowsData ?? []) as PointRow[]

      if (examErr) {
        console.error(examErr)
        setExamResults([])
        setErrorMsg('Exam results are unavailable right now. Behaviour points are still shown.')
      } else {
        setExamResults((examData ?? []) as ExamResult[])
      }

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

  const examResultsByStudent = useMemo(() => {
    const grouped: Record<string, ExamResult[]> = {}
    for (const result of examResults) grouped[result.student_id] = [...(grouped[result.student_id] ?? []), result]
    for (const results of Object.values(grouped)) results.sort(compareExamResults)
    return grouped
  }, [examResults])

  const S = styles(isMobile)

  if (loading) {
    return (
      <main className="nasfat-app" style={S.page}>
        <div style={S.content}>
          <div className="nasfat-surface nasfat-enter" style={S.centerCard} aria-label="Loading student results">
            <div className="nasfat-skeleton" style={{ width: 170, height: 22 }}>Loading</div>
            <div className="nasfat-skeleton" style={{ width: '78%', height: 13, marginTop: 10 }}>Loading</div>
            <div className="nasfat-skeleton" style={{ height: 104, marginTop: 18 }}>Loading</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="nasfat-app" style={S.page}>

      <div style={S.content}>
        <header className="nasfat-surface nasfat-enter" style={S.header}>
          <div style={S.headerLeft}>
            <div>
              <div style={S.eyebrow}>Family portal</div>
              <h1 data-heading="true" style={S.headerTitle}>Parent Portal</h1>
              <div style={S.headerSub}>Madrasa progress, results and behaviour points</div>
            </div>
          </div>

          <div style={S.headerRight}>
            <Image className="nasfat-logo" src="/nasfat-logo.png" alt="NASFAT Manchester" width={44} height={44} style={S.headerLogo} />

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

        <section className="nasfat-surface nasfat-enter" style={S.topInfoCard} aria-label="Today's information">
          <div>
            <div style={S.mutedLabel}>Today</div>
            <div className="nasfat-number" style={S.todayBig}>{todayLabel}</div>
          </div>

          <div style={S.tipBox}>
            <div style={{ fontWeight: 900, color: '#1F3A5F' }}>Tip</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6B7280' }}>
              If it says <b>Not updated yet</b>, the teacher hasn’t saved today’s points.
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="nasfat-status" role="alert" style={S.errorCard}>
            <b>Something went wrong:</b> {errorMsg}
          </div>
        )}

        {students.length === 0 ? (
          <div className="nasfat-surface nasfat-enter" style={S.centerCard}>
            <p style={{ margin: 0, fontWeight: 900, color: '#1F3A5F' }}>No students linked</p>
            <p style={{ marginTop: 8, color: '#6B7280', fontSize: 13 }}>
              Please contact the madrasa admin to link your account to your student(s).
            </p>
          </div>
        ) : (
          <>
            <section className="nasfat-enter" style={S.examSection} aria-labelledby="latest-exam-results">
              <div style={S.sectionHeading}>
                <div>
                  <h2 id="latest-exam-results" style={S.sectionTitle}>Latest exam results</h2>
                  <div style={S.sectionHint}>The latest Quran, Islamic Studies, and Arabic exam month is shown first.</div>
                </div>
                <span className="nasfat-number" style={S.sectionPill}>{examResults.length ? `${examResults.length} recorded` : 'No results yet'}</span>
              </div>

              <div style={S.examGrid}>
                {students.map((s) => {
                  const name = `${s.first_name}${s.last_name ? ` ${s.last_name}` : ''}`
                  const [latest, ...history] = examResultsByStudent[s.id] ?? []
                  const historyOpen = examHistoryOpen[s.id] ?? false

                  return (
                    <article className="nasfat-row nasfat-stagger" key={s.id} style={S.examCard}>
                      <div style={S.childHeader}>
                        <div>
                          <div style={S.childName}>{name}</div>
                          <div style={S.childMeta}>{latest ? `Latest exam: ${formatExamMonth(latest.exam_date)}` : 'No exam result published yet'}</div>
                        </div>
                        {latest && <div style={S.badgeUpdated}>Latest</div>}
                      </div>

                      {latest ? (
                        <div style={S.examScoreRow}>
                          <div style={S.examScoreBox}><div style={S.examScoreLabel}>Quran</div><div className="nasfat-number" style={S.examScoreValue}>{formatScore(latest.quran_score, latest.quran_max_score)}</div></div>
                          <div style={S.examScoreBox}><div style={S.examScoreLabel}>Islamic Studies</div><div className="nasfat-number" style={S.examScoreValue}>{formatScore(latest.islamic_studies_score, latest.islamic_studies_max_score)}</div></div>
                          <div style={S.examScoreBox}><div style={S.examScoreLabel}>Arabic</div><div className="nasfat-number" style={S.examScoreValue}>{formatScore(latest.arabic_score, latest.arabic_max_score)}</div></div>
                        </div>
                      ) : (
                        <div style={S.noExamResult}>Your madrasa will add results here once they are available.</div>
                      )}

                      {history.length > 0 && (
                        <>
                          <button
                            className="nasfat-button"
                            type="button"
                            onClick={() => setExamHistoryOpen((current) => ({ ...current, [s.id]: !current[s.id] }))}
                            style={S.examHistoryButton}
                            aria-expanded={historyOpen}
                          >
                            {historyOpen ? 'Hide exam history' : `Exam history (${history.length})`}
                          </button>
                          {historyOpen && (
                            <div className="nasfat-expand" style={S.examHistoryList}>
                              {history.map((result) => (
                                <div key={result.id} style={S.examHistoryItem}>
                                  <div style={S.examHistoryDate}>{formatExamMonth(result.exam_date)}</div>
                                  <div style={S.examHistoryScores}>
                                    <span>Quran <b>{formatScore(result.quran_score, result.quran_max_score)}</b></span>
                                    <span>Islamic Studies <b>{formatScore(result.islamic_studies_score, result.islamic_studies_max_score)}</b></span>
                                    <span>Arabic <b>{formatScore(result.arabic_score, result.arabic_max_score)}</b></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="nasfat-enter" style={S.pointsSection} aria-labelledby="behaviour-points">
              <div style={S.sectionHeading}>
                <div>
                  <h2 id="behaviour-points" style={S.sectionTitle}>Behaviour points</h2>
                  <div style={S.sectionHint}>Today’s update and cumulative totals for each student.</div>
                </div>
              </div>
              <div style={S.grid}>
                {students.map((s) => {
                  const name = `${s.first_name}${s.last_name ? ` ${s.last_name}` : ''}`
                  const todayVal = todayMap[s.id]
                  const totalVal = totals[s.id] ?? 0

                  return (
                    <article className="nasfat-row nasfat-stagger" key={s.id} style={S.childCard}>
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
                          <div className="nasfat-number" style={S.metricValue}>{todayVal === null ? '—' : todayVal}</div>
                        </div>

                        <div style={S.metricBox}>
                          <div style={S.metricLabel}>Total</div>
                          <div className="nasfat-number" style={S.metricValue}>{totalVal}</div>
                        </div>
                      </div>

                      <div style={S.footerNote}>Points reflect behaviour and effort in class.</div>
                    </article>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
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
    width: '100%',
    maxWidth: 920,
    margin: '0 auto',
    padding: isMobile ? '12px 12px max(44px, env(safe-area-inset-bottom))' : '24px 24px 52px',
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
    flexWrap: 'wrap',
    boxShadow: '0 14px 38px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  headerTitle: {
    margin: 0,
    fontSize: isMobile ? 20 : 25,
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
    marginTop: 16,
    background: 'rgba(234, 244, 251, 0.92)',
    border: '1px solid rgba(207, 230, 246, 0.85)',
    borderRadius: isMobile ? 20 : 22,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 12,
    flexWrap: 'wrap',
    boxShadow: '0 10px 28px rgba(31, 58, 95, 0.08)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  mutedLabel: {
    fontSize: 12,
    color: '#1F3A5F',
    opacity: 0.75,
    fontWeight: 900,
  },
  todayBig: {
    fontSize: isMobile ? 18 : 21,
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
    borderRadius: 22,
    padding: 18,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },

  examSection: {
    marginTop: 18,
  },
  pointsSection: {
    marginTop: 26,
  },
  sectionHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    color: '#1F3A5F',
    fontSize: isMobile ? 17 : 19,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  sectionHint: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  sectionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 28,
    borderRadius: 999,
    padding: '4px 10px',
    background: '#EAF4FB',
    border: '1px solid #CFE6F6',
    color: '#1F3A5F',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  examGrid: {
    marginTop: 14,
    display: 'grid',
    gap: 14,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
  },
  examCard: {
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid rgba(207, 230, 246, 0.95)',
    borderRadius: 20,
    padding: isMobile ? 16 : 18,
    boxShadow: '0 12px 32px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  examScoreRow: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  examScoreBox: {
    minWidth: 0,
    background: '#F5FAFE',
    border: '1px solid #D8EAF7',
    borderRadius: 14,
    padding: '11px 6px',
    textAlign: 'center',
  },
  examScoreLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  examScoreValue: {
    marginTop: 5,
    color: '#1F3A5F',
    fontSize: isMobile ? 21 : 23,
    fontWeight: 900,
    lineHeight: 1,
    overflowWrap: 'anywhere',
  },
  noExamResult: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    background: '#F8FAFC',
    border: '1px dashed #CBD5E1',
    color: '#64748B',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.45,
  },
  examHistoryButton: {
    width: '100%',
    minHeight: 46,
    marginTop: 12,
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: 14,
    padding: '10px 13px',
    color: '#1F3A5F',
    fontSize: 14,
    fontWeight: 900,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: '0 2px 7px rgba(31, 58, 95, 0.05)',
  },
  examHistoryList: {
    marginTop: 8,
    padding: '2px 12px',
    borderRadius: 14,
    background: '#F8FBFE',
    border: '1px solid #D8EAF7',
  },
  examHistoryItem: {
    padding: '12px 0',
    borderTop: '1px solid #E2E8F0',
  },
  examHistoryDate: {
    color: '#1F3A5F',
    fontSize: 13,
    fontWeight: 900,
  },
  examHistoryScores: {
    marginTop: 7,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 7,
    color: '#64748B',
    fontSize: 11,
    lineHeight: 1.35,
  },

  grid: {
    marginTop: 16,
    display: 'grid',
    gap: 14,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
  },

  childCard: {
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(203, 213, 225, 0.72)',
    borderRadius: 20,
    padding: isMobile ? 16 : 18,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',

    boxShadow: '0 12px 32px rgba(31, 58, 95, 0.09)',
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
