'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { attendanceSummary, formatAttendancePercentage } from '@/lib/attendance'

type Student = {
  id: string
  first_name: string
  last_name: string | null
  class_id: string | null
  active: boolean
  attendance_started_on: string | null
}

type ClassRow = { id: string; name: string }

type PointRow = {
  student_id: string
  date: string
  points: number
}

type AttendanceRow = {
  student_id: string
  class_date: string
  present: boolean
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

type StudentNote = {
  id: string
  student_id: string
  title: string | null
  content: string
  created_at: string | null
}

type StudentNoteRead = {
  note_id: string
  read_at: string
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

function formatNoteDate(value: string | null) {
  if (!value) return 'Date not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

export default function ParentPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [todayMap, setTodayMap] = useState<Record<string, number | null>>({})
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [classNames, setClassNames] = useState<Record<string, string>>({})
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([])
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([])
  const [noteReadAt, setNoteReadAt] = useState<Record<string, string>>({})
  const [examHistoryOpen, setExamHistoryOpen] = useState<Record<string, boolean>>({})
  const [noteHistoryOpen, setNoteHistoryOpen] = useState<Record<string, boolean>>({})
  const [markingNoteIds, setMarkingNoteIds] = useState<Record<string, boolean>>({})
  const [noteMessage, setNoteMessage] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
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
      setParentId(user.id)

      const { data: kids, error: kidsErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, active, attendance_started_on')
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
        setClassNames({})
        setAttendanceRows([])
        setStudentNotes([])
        setNoteReadAt({})
        setLoading(false)
        return
      }

      const ids = studentList.map((s) => s.id)

      const [
        { data: rowsData, error: rowsErr },
        { data: examData, error: examErr },
        { data: classData, error: classErr },
        { data: attendanceData, error: attendanceErr },
        { data: noteData, error: noteErr },
        { data: noteReadData, error: noteReadErr },
      ] = await Promise.all([
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
        supabase
          .from('classes')
          .select('id, name')
          .order('name'),
        supabase
          .from('student_attendance')
          .select('student_id, class_date, present')
          .in('student_id', ids)
          .eq('present', true),
        supabase
          .from('student_notes')
          .select('id, student_id, title, content, created_at')
          .in('student_id', ids)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_note_reads')
          .select('note_id, read_at')
          .eq('parent_id', user.id),
      ])

      if (rowsErr) {
        console.error(rowsErr)
        setErrorMsg(rowsErr.message)
        setLoading(false)
        return
      }

      const rows = (rowsData ?? []) as PointRow[]

      const warnings: string[] = []
      if (examErr) {
        console.error(examErr)
        setExamResults([])
        warnings.push('Exam results are unavailable right now.')
      } else {
        setExamResults((examData ?? []) as ExamResult[])
      }

      if (classErr) {
        console.error(classErr)
        setClassNames({})
        warnings.push('Class names are unavailable right now.')
      } else {
        setClassNames(Object.fromEntries(((classData ?? []) as ClassRow[]).map((item) => [item.id, item.name])))
      }

      if (attendanceErr) {
        console.error(attendanceErr)
        setAttendanceRows([])
        warnings.push('Attendance is unavailable right now.')
      } else {
        setAttendanceRows((attendanceData ?? []) as AttendanceRow[])
      }

      if (noteErr) {
        console.error(noteErr)
        setStudentNotes([])
        warnings.push('Teacher notes are unavailable right now.')
      } else {
        setStudentNotes((noteData ?? []) as StudentNote[])
      }

      if (noteReadErr) {
        console.error(noteReadErr)
        setNoteReadAt({})
        warnings.push('Note history status is unavailable right now.')
      } else {
        setNoteReadAt(Object.fromEntries(((noteReadData ?? []) as StudentNoteRead[]).map((read) => [read.note_id, read.read_at])))
      }
      setErrorMsg(warnings.length ? `${warnings.join(' ')} Behaviour points are still shown.` : null)

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

  const attendanceDatesByStudent = useMemo(() => {
    const grouped: Record<string, string[]> = {}
    for (const row of attendanceRows) {
      if (row.present) grouped[row.student_id] = [...(grouped[row.student_id] ?? []), row.class_date]
    }
    return grouped
  }, [attendanceRows])

  const notesByStudent = useMemo(() => {
    const grouped: Record<string, StudentNote[]> = {}
    for (const note of studentNotes) grouped[note.student_id] = [...(grouped[note.student_id] ?? []), note]
    return grouped
  }, [studentNotes])

  const unreadNoteCount = useMemo(
    () => studentNotes.reduce((count, note) => count + (noteReadAt[note.id] ? 0 : 1), 0),
    [noteReadAt, studentNotes],
  )

  const markNoteRead = async (note: StudentNote) => {
    if (!parentId || markingNoteIds[note.id]) return
    setMarkingNoteIds((current) => ({ ...current, [note.id]: true }))
    setNoteMessage(null)
    const readAt = new Date().toISOString()
    const { error } = await supabase.from('student_note_reads').upsert({
      note_id: note.id,
      parent_id: parentId,
      read_at: readAt,
    }, { onConflict: 'note_id,parent_id', ignoreDuplicates: true })

    if (error) {
      console.error(error)
      setNoteMessage('That note could not be marked as read. Please try again.')
    } else {
      setNoteReadAt((current) => ({ ...current, [note.id]: readAt }))
      setNoteHistoryOpen((current) => ({ ...current, [note.student_id]: true }))
      setNoteMessage('Note moved to past notes.')
    }
    setMarkingNoteIds((current) => ({ ...current, [note.id]: false }))
  }

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
            <section className="nasfat-enter" style={S.notesSection} aria-labelledby="teacher-notes">
              <div style={S.sectionHeading}>
                <div>
                  <h2 id="teacher-notes" style={S.sectionTitle}>Teacher notes</h2>
                  <div style={S.sectionHint}>New notes stay here until you mark them as read. Every past note remains in history.</div>
                </div>
                <span className="nasfat-number" aria-live="polite" style={{ ...S.sectionPill, ...(unreadNoteCount > 0 ? S.notificationPill : {}) }}>
                  {unreadNoteCount > 0 ? `${unreadNoteCount} new` : 'All caught up'}
                </span>
              </div>

              {noteMessage && <div className="nasfat-status" role="status" aria-live="polite" style={{ ...S.noteMessage, ...(noteMessage.startsWith('That note') ? S.noteMessageError : {}) }}>{noteMessage}</div>}

              <div style={S.noteGrid}>
                {students.map((student) => {
                  const name = `${student.first_name}${student.last_name ? ` ${student.last_name}` : ''}`
                  const classLabel = student.class_id ? classNames[student.class_id] ?? 'Class unavailable' : 'Class not assigned'
                  const notes = notesByStudent[student.id] ?? []
                  const currentNotes = notes.filter((note) => !noteReadAt[note.id])
                  const pastNotes = notes.filter((note) => noteReadAt[note.id])
                  const historyOpen = noteHistoryOpen[student.id] ?? false

                  return <article className="nasfat-row nasfat-stagger" key={student.id} style={S.noteStudentCard}>
                    <div style={S.childHeader}>
                      <div>
                        <div style={S.childName}>{name}</div>
                        <div style={S.childMeta}>{classLabel} · Teacher notes</div>
                      </div>
                      <span style={currentNotes.length > 0 ? S.newNoteBadge : S.badgeUpdated}>
                        {currentNotes.length > 0 ? `${currentNotes.length} new` : 'No new notes'}
                      </span>
                    </div>

                    {currentNotes.length > 0 ? <div style={S.currentNoteList}>
                      {currentNotes.map((note) => <div key={note.id} style={S.currentNoteCard}>
                        <div style={S.noteMetaRow}>
                          <span className="nasfat-number" style={S.noteDate}>{formatNoteDate(note.created_at)}</span>
                          <span style={S.newNoteLabel}>New</span>
                        </div>
                        {note.title && <div style={S.noteTitle}>{note.title}</div>}
                        <div style={S.noteContent}>{note.content}</div>
                        <button
                          className="nasfat-button"
                          type="button"
                          disabled={markingNoteIds[note.id]}
                          onClick={() => void markNoteRead(note)}
                          style={S.markReadButton}
                        >
                          {markingNoteIds[note.id] ? <><span className="nasfat-spinner" aria-hidden="true" />Saving…</> : 'Mark as read'}
                        </button>
                      </div>)}
                    </div> : <div style={S.noCurrentNotes}>{notes.length > 0 ? 'You have read every note for this student.' : 'No teacher notes have been added yet.'}</div>}

                    {pastNotes.length > 0 && <>
                      <button
                        className="nasfat-button"
                        type="button"
                        onClick={() => setNoteHistoryOpen((current) => ({ ...current, [student.id]: !current[student.id] }))}
                        style={S.noteHistoryButton}
                        aria-expanded={historyOpen}
                      >
                        {historyOpen ? 'Hide past notes' : `Past notes (${pastNotes.length})`}
                      </button>
                      {historyOpen && <div className="nasfat-expand" style={S.noteHistoryList}>
                        {pastNotes.map((note) => <div key={note.id} style={S.pastNoteItem}>
                          <div style={S.noteMetaRow}>
                            <span className="nasfat-number" style={S.noteDate}>{formatNoteDate(note.created_at)}</span>
                            <span style={S.readLabel}>Read</span>
                          </div>
                          {note.title && <div style={S.noteTitle}>{note.title}</div>}
                          <div style={S.noteContent}>{note.content}</div>
                        </div>)}
                      </div>}
                    </>}
                  </article>
                })}
              </div>
            </section>

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
                  const classLabel = s.class_id ? classNames[s.class_id] ?? 'Class unavailable' : 'Class not assigned'
                  const [latest, ...history] = examResultsByStudent[s.id] ?? []
                  const historyOpen = examHistoryOpen[s.id] ?? false

                  return (
                    <article className="nasfat-row nasfat-stagger" key={s.id} style={S.examCard}>
                      <div style={S.childHeader}>
                        <div>
                          <div style={S.childName}>{name}</div>
                          <div style={S.childMeta}>{classLabel} · {latest ? `Latest exam: ${formatExamMonth(latest.exam_date)}` : 'No exam result published yet'}</div>
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
                  const classLabel = s.class_id ? classNames[s.class_id] ?? 'Class unavailable' : 'Class not assigned'
                  const todayVal = todayMap[s.id]
                  const totalVal = totals[s.id] ?? 0
                  const attendance = attendanceSummary(s.attendance_started_on, attendanceDatesByStudent[s.id] ?? [])

                  return (
                    <article className="nasfat-row nasfat-stagger" key={s.id} style={S.childCard}>
                      <div style={S.childHeader}>
                        <div>
                          <div style={S.childName}>{name}</div>
                          <div style={S.childMeta}>{classLabel} · Madrasa progress</div>
                        </div>

                        <div style={todayVal === null ? S.badgePending : S.badgeUpdated}>
                          {todayVal === null ? 'Not updated yet' : 'Updated'}
                        </div>
                      </div>

                      <div style={S.metricsRow}>
                        <div style={S.metricBox}>
                          <div style={S.metricLabel}>Attendance</div>
                          <div className="nasfat-number" style={S.metricValue}>{s.active ? formatAttendancePercentage(attendance.percentage) : '—'}</div>
                        </div>

                        <div style={S.metricBox}>
                          <div style={S.metricLabel}>Today</div>
                          <div className="nasfat-number" style={S.metricValue}>{todayVal === null ? '—' : todayVal}</div>
                        </div>

                        <div style={S.metricBox}>
                          <div style={S.metricLabel}>Total</div>
                          <div className="nasfat-number" style={S.metricValue}>{totalVal}</div>
                        </div>
                      </div>

                      <div style={S.footerNote}>
                        {s.active
                          ? attendance.total > 0
                            ? `${attendance.attended} of ${attendance.total} Saturday classes attended. Points reflect behaviour and effort in class.`
                            : 'Attendance starts at 100% and updates after the first completed Saturday class.'
                          : 'This student is archived; attendance tracking is paused.'}
                      </div>
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

  notesSection: {
    marginTop: 18,
  },
  notificationPill: {
    background: '#FFF7E8',
    border: '1px solid #F3D39B',
    color: '#8A5208',
    boxShadow: '0 5px 14px rgba(154, 90, 6, 0.10)',
  },
  noteMessage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: '1px solid #CFE6F6',
    background: '#EAF4FB',
    color: '#1F3A5F',
    fontSize: 13,
    fontWeight: 800,
  },
  noteMessageError: {
    border: '1px solid #FECACA',
    background: '#FEF2F2',
    color: '#B91C1C',
  },
  noteGrid: {
    marginTop: 14,
    display: 'grid',
    gap: 14,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
  },
  noteStudentCard: {
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid rgba(207, 230, 246, 0.95)',
    borderRadius: 20,
    padding: isMobile ? 16 : 18,
    boxShadow: '0 12px 32px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  newNoteBadge: {
    flexShrink: 0,
    borderRadius: 999,
    padding: '6px 10px',
    border: '1px solid #F3D39B',
    background: '#FFF7E8',
    color: '#8A5208',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  currentNoteList: {
    marginTop: 12,
    display: 'grid',
    gap: 10,
  },
  currentNoteCard: {
    padding: 13,
    borderRadius: 16,
    border: '1px solid #F3D39B',
    background: 'linear-gradient(145deg, #FFF9ED, #FFFFFF)',
    boxShadow: '0 5px 16px rgba(154, 90, 6, 0.07)',
  },
  noteMetaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noteDate: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 800,
  },
  newNoteLabel: {
    borderRadius: 999,
    padding: '4px 8px',
    background: '#9A5A06',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  readLabel: {
    borderRadius: 999,
    padding: '4px 8px',
    border: '1px solid #D8EAF7',
    background: '#F5FAFE',
    color: '#1F5E91',
    fontSize: 10,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  noteTitle: {
    marginTop: 10,
    color: '#1F3A5F',
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.3,
  },
  noteContent: {
    marginTop: 7,
    color: '#374151',
    fontSize: 14,
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
  markReadButton: {
    width: '100%',
    minHeight: 46,
    marginTop: 12,
    borderRadius: 14,
    border: '1px solid #152C4A',
    background: 'linear-gradient(180deg, #294B74 0%, #1F3A5F 100%)',
    color: '#FFFFFF',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 900,
    boxShadow: '0 8px 18px rgba(31, 58, 95, 0.20)',
  },
  noCurrentNotes: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: '1px dashed #CBD5E1',
    background: '#F8FAFC',
    color: '#64748B',
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.45,
  },
  noteHistoryButton: {
    width: '100%',
    minHeight: 46,
    marginTop: 12,
    borderRadius: 14,
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#1F3A5F',
    padding: '10px 13px',
    fontSize: 14,
    fontWeight: 900,
    textAlign: 'left',
    boxShadow: '0 2px 7px rgba(31, 58, 95, 0.05)',
  },
  noteHistoryList: {
    marginTop: 8,
    padding: '2px 12px',
    borderRadius: 14,
    border: '1px solid #D8EAF7',
    background: '#F8FBFE',
  },
  pastNoteItem: {
    padding: '12px 0',
    borderTop: '1px solid #E2E8F0',
  },

  examSection: {
    marginTop: 26,
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
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },

  metricBox: {
    minWidth: 0,
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    padding: isMobile ? '12px 7px' : '14px 10px',
    boxShadow: '0 4px 12px rgba(31, 58, 95, 0.08)',
    textAlign: 'center',
  },

  metricLabel: {
    fontSize: isMobile ? 11 : 12,
    color: '#6B7280',
    fontWeight: 900,
    lineHeight: 1.2,
  },

  metricValue: {
    marginTop: 6,
    fontSize: isMobile ? 22 : 25,
    fontWeight: 900,
    color: '#1F3A5F',
    letterSpacing: -0.5,
    overflowWrap: 'anywhere',
  },

  footerNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
  },
})
