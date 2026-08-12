'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

type Student = {
  id: string
  first_name: string
  last_name: string | null
}

type PointRow = {
  student_id: string
  points: number
}

type StudentNote = {
  id: string
  student_id: string
  title: string | null
  content: string
  created_at: string
}

type EditorRole = 'admin' | 'staff'

export default function ClassPage() {
  const { classId } = useParams<{ classId: string }>()
  const router = useRouter()

  const [students, setStudents] = useState<Student[]>([])
  const [points, setPoints] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState<Record<string, number>>({})

  const [notesByStudent, setNotesByStudent] = useState<Record<string, StudentNote[]>>({})
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const [newNote, setNewNote] = useState<Record<string, string>>({})
  const [noteStatus, setNoteStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})

  const [className, setClassName] = useState('Class')
  const [role, setRole] = useState<EditorRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date()), [])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const clampPoints = (n: number) => Math.max(-20, Math.min(20, n))

  useEffect(() => {
    const loadData = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) return router.push('/login')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profileError || (profile?.role !== 'admin' && profile?.role !== 'staff')) {
        router.replace('/login')
        return
      }
      setRole(profile.role)

      const [{ data: classData }, { data: studentData, error }] = await Promise.all([
        supabase.from('classes').select('name').eq('id', classId).maybeSingle(),
        supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('class_id', classId)
          .eq('active', true)
          .order('first_name'),
      ])

      setClassName(classData?.name ?? 'Class')

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const studentList = studentData ?? []
      setStudents(studentList)

      const initialPoints: Record<string, number> = {}
      studentList.forEach(s => (initialPoints[s.id] = 0))
      setPoints(initialPoints)

      if (studentList.length === 0) {
        setLoading(false)
        return
      }

      const ids = studentList.map(s => s.id)

      const { data: totalsData } = await supabase
        .from('daily_points')
        .select('student_id, points')
        .in('student_id', ids)

      const totalsMap: Record<string, number> = {}
      ;(totalsData ?? []).forEach((row: PointRow) => {
        totalsMap[row.student_id] =
          (totalsMap[row.student_id] ?? 0) + row.points
      })
      setTotals(totalsMap)

      const { data: notesData } = await supabase
        .from('student_notes')
        .select('*')
        .in('student_id', ids)
        .order('created_at', { ascending: false })

      const grouped: Record<string, StudentNote[]> = {}
      ;(notesData ?? []).forEach(note => {
        if (!grouped[note.student_id]) grouped[note.student_id] = []
        grouped[note.student_id].push(note)
      })
      setNotesByStudent(grouped)

      setLoading(false)
    }

    loadData()
  }, [classId, router])

  const handleSaveToday = async () => {
    setSaving(true)
    setSaveMsg(null)

    const rows = students.map(s => ({
      student_id: s.id,
      date: todayISO,
      points: clampPoints(points[s.id] ?? 0),
    }))

    const { error } = await supabase
      .from('daily_points')
      .upsert(rows, { onConflict: 'student_id,date' })

    setSaving(false)

    if (error) {
      setSaveMsg('Could not save today’s points. Please try again.')
      return
    }

    setSaveMsg('Points saved for today.')
  }

  const S = styles(isMobile)

  if (loading) {
    return (
      <main className="nasfat-app" style={S.page}>
        <div style={S.content}>
          <div className="nasfat-surface nasfat-enter" style={S.header}>
            <div className="nasfat-skeleton" style={{ width: 185, height: 44 }}>Loading class</div>
            <div className="nasfat-skeleton" style={{ width: 44, height: 44, borderRadius: 14 }}>Loading</div>
          </div>
          <div className="nasfat-surface nasfat-enter" style={S.stickyBar}>
            <div className="nasfat-skeleton" style={{ width: 165, height: 40 }}>Loading date</div>
            <div className="nasfat-skeleton" style={{ width: isMobile ? '100%' : 120, height: 48 }}>Loading</div>
          </div>
          {[0, 1, 2].map((item) => <div className="nasfat-skeleton" key={item} style={{ height: 92, marginTop: 10 }}>Loading student</div>)}
        </div>
      </main>
    )
  }


return (
  <main className="nasfat-app" style={S.page}>
    <div style={S.content}>
      <header className="nasfat-surface nasfat-enter" style={S.header}>
        <div style={S.headerLeft}>
          <button className="nasfat-button" type="button" onClick={() => router.push(role === 'staff' ? '/staff' : '/admin')} style={S.backBtn}>
            ← Back
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={S.eyebrow}>Points register</div>
            <h1 data-heading="true" style={S.headerTitle}>{className}</h1>
            <div style={S.headerSub}>{students.length} active {students.length === 1 ? 'student' : 'students'}</div>
          </div>
        </div>

        <Image
          className="nasfat-logo"
          src="/nasfat-logo.png"
          alt="NASFAT Manchester"
          width={44}
          height={44}
          priority
          style={S.headerLogo}
        />
      </header>

      <section className="nasfat-surface nasfat-enter" style={S.stickyBar} aria-label="Save today's points">
        <div>
          <div style={S.mutedLabel}>Today</div>
          <div className="nasfat-number" style={S.todayBig}>{todayLabel}</div>
          {saveMsg && <div className="nasfat-status" role="status" style={{ ...S.saveMsg, ...(saveMsg.startsWith('Could not') ? S.saveMsgError : {}) }}>{saveMsg}</div>}
        </div>

        <button
          className="nasfat-button"
          type="button"
          onClick={handleSaveToday}
          disabled={saving}
          style={S.saveBtn}
        >
          {saving ? <><span className="nasfat-spinner" aria-hidden="true" />Saving…</> : 'Save today'}
        </button>
      </section>

      {students.length === 0 ? (
        <div className="nasfat-surface nasfat-enter" style={S.card}>No active students are assigned to this class yet.</div>
      ) : (
        <div style={S.grid}>
          {students.map((s) => {
            const name = `${s.first_name}${s.last_name ? ` ${s.last_name}` : ''}`
            const notes = notesByStudent[s.id] ?? []
            const isOpen = openNotes[s.id]
            const status = noteStatus[s.id] ?? 'idle'

            return (
              <article className="nasfat-row nasfat-stagger" key={s.id} style={S.studentRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={S.studentName}>{name}</div>
                  <div className="nasfat-number" style={S.studentMeta}>
                    Total: {totals[s.id] ?? 0}
                  </div>

                  {!isOpen && (
                    <button
                      className="nasfat-button"
                      type="button"
                      aria-expanded={false}
                      style={{ ...S.noteToggle, color: notes.length > 0 ? '#9A5A06' : '#1F5E91' }}
                      onClick={() =>
                        setOpenNotes((o) => ({ ...o, [s.id]: true }))
                      }
                    >
                      {notes.length > 0 ? `View teacher notes (${notes.length})` : 'Add a teacher note'}
                    </button>
                  )}

                  {isOpen && (
                    <div className="nasfat-expand" style={S.notesPanel}>
                      <div style={S.notesHeader}>
                        <div style={S.notesTitle}>Teacher notes</div>
                        <button className="nasfat-button" type="button" aria-expanded={true} onClick={() => setOpenNotes((current) => ({ ...current, [s.id]: false }))} style={S.noteClose}>Hide</button>
                      </div>
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            background: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(229,231,235,0.7)',
                            borderRadius: 13,
                            padding: 11,
                            marginBottom: 8,
                          }}
                        >
                          {n.title && (
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 13,
                                marginBottom: 4,
                              }}
                            >
                              {n.title}
                            </div>
                          )}
                          <div style={{ fontSize: 13 }}>{n.content}</div>
                        </div>
                     ))}

                      <textarea
                        id={`student-note-${s.id}`}
                        name="student_note"
                        aria-label={`Add a teacher note for ${name}`}
                        placeholder="Add a note for parents…"
                        value={newNote[s.id] ?? ''}
                        onChange={(e) =>
                          setNewNote((n) => ({
                            ...n,
                            [s.id]: e.target.value,
                          }))
                        }
                        style={{
                          width: '100%',
                          minHeight: 90,
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          border: '1px solid rgba(209,213,219,1)',
                          fontSize: 13,
                          background: '#FFFFFF',
                          color: '#111827',
                          resize: 'vertical',
                        }}
                      />


                      <button
                        className="nasfat-button"
                        type="button"
                        disabled={status === 'saving'}
                        style={{
                          marginTop: 6,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(209,213,219,1)',
                          background:
                            status === 'saved' ? '#16834C' : status === 'error' ? '#B91C1C' : '#1F3A5F',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          cursor: status === 'saving' ? 'default' : 'pointer',
                          opacity: status === 'saving' ? 0.7 : 1,
                        }}
                        onClick={async () => {
                          const content = newNote[s.id]?.trim()
                          if (!content) return

                          setNoteStatus((n) => ({ ...n, [s.id]: 'saving' }))

                          const {
                            data: { user },
                          } = await supabase.auth.getUser()

                          const { error } = await supabase.from('student_notes').insert({
                            student_id: s.id,
                            content,
                            created_by: user?.id,
                          })

                          if (error) {
                            console.error('Note insert error:', error)
                            setNoteStatus((n) => ({ ...n, [s.id]: 'error' }))
                            return
                          }

                          // success
                          setNewNote((n) => ({ ...n, [s.id]: '' }))
                          setNoteStatus((n) => ({ ...n, [s.id]: 'saved' }))

                          setTimeout(() => {
                            setNoteStatus((n) => ({ ...n, [s.id]: 'idle' }))
                          }, 2000)
                        }}
                      >
                        {status === 'saving'
                          ? <><span className="nasfat-spinner" aria-hidden="true" />Saving…</>
                          : status === 'saved'
                          ? 'Note added'
                          : status === 'error'
                          ? 'Try again'
                          : 'Add note'
                          }
                      </button>
                      {status === 'error' && <div className="nasfat-status" role="alert" style={S.noteError}>The note could not be added. Please try again.</div>}
                    </div>
                  )}
                </div>

                <div style={S.controls}>
                  <button
                    className="nasfat-button"
                    type="button"
                    aria-label={`Remove one point from ${name}`}
                    style={S.ctrlBtn}
                    onClick={() =>
                      setPoints((p) => ({
                        ...p,
                        [s.id]: clampPoints((p[s.id] ?? 0) - 1),
                      }))
                    }
                  >
                    –
                  </button>

                  <div className="nasfat-number" aria-live="polite" aria-label={`${points[s.id] ?? 0} points`} style={S.valuePill}>{points[s.id] ?? 0}</div>

                  <button
                    className="nasfat-button"
                    type="button"
                    aria-label={`Add one point to ${name}`}
                    style={S.ctrlBtn}
                    onClick={() =>
                      setPoints((p) => ({
                        ...p,
                        [s.id]: clampPoints((p[s.id] ?? 0) + 1),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </article>
            )
          })}
        </div>
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

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },

  headerLogo: {
    width: isMobile ? 38 : 44,
    height: 'auto',
    opacity: 0.95,
    flexShrink: 0,
  },

  content: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 860,
    margin: '0 auto',
    padding: isMobile ? '12px 12px max(42px, env(safe-area-inset-bottom))' : '24px 24px 48px',
  },

  header: {
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(203, 213, 225, 0.76)',
    borderRadius: isMobile ? 22 : 26,
    padding: isMobile ? 14 : 18,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 14px 38px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },

  backBtn: {
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 900,
    cursor: 'pointer',
    color: '#111827',
  },

  headerTitle: {
    margin: 0,
    fontSize: isMobile ? 19 : 23,
    fontWeight: 900,
    color: '#1F3A5F',
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
  },

  eyebrow: {
    marginBottom: 5,
    color: '#4E83A5',
    fontSize: 9,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  stickyBar: {
    position: 'sticky',
    zIndex: 4,
    top: 10,
    marginTop: 14,
    background: 'rgba(234, 244, 251, 0.94)',
    border: '1px solid rgba(207, 230, 246, 0.95)',
    borderRadius: isMobile ? 20 : 22,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    boxShadow: '0 10px 28px rgba(31, 58, 95, 0.11)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },

  mutedLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: '#1F3A5F',
    opacity: 0.75,
  },

  todayBig: {
    fontSize: 20,
    fontWeight: 900,
    color: '#1F3A5F',
    marginTop: 2,
  },

  saveMsg: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 800,
    color: '#1F3A5F',
  },

  saveMsgError: {
    color: '#B91C1C',
  },

  saveBtn: {
    minHeight: 48,
    background: 'linear-gradient(180deg, #294B74 0%, #1F3A5F 100%)',
    color: '#FFFFFF',
    border: '1px solid rgba(15, 23, 42, 0.2)',
    borderRadius: 14,
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 900,
    width: isMobile ? '100%' : undefined,
    boxShadow: '0 8px 18px rgba(31, 58, 95, 0.23)',
  },

  card: {
    marginTop: 14,
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid rgba(203, 213, 225, 0.72)',
    borderRadius: 22,
    padding: isMobile ? 16 : 18,
    color: '#111827',
    boxShadow: '0 14px 38px rgba(31, 58, 95, 0.10)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },

  grid: {
    marginTop: 14,
    display: 'grid',
    gap: 10,
  },

  studentRow: {
    background: 'rgba(255, 255, 255, 0.91)',
    border: '1px solid rgba(203, 213, 225, 0.76)',
    borderRadius: 20,
    padding: isMobile ? 15 : 16,
    color: '#111827',
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center',
    gap: 14,
    boxShadow: '0 5px 16px rgba(31, 58, 95, 0.055)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  studentName: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1F3A5F',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: isMobile ? '100%' : 300,
  },

  studentMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: isMobile ? 'space-between' : 'flex-end',
    gap: 10,
    flexShrink: 0,
    width: isMobile ? '100%' : undefined,
    paddingTop: isMobile ? 2 : 0,
  },

  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: '1px solid rgba(203, 213, 225, 0.95)',
    background: '#FFFFFF',
    fontSize: 20,
    fontWeight: 900,
    cursor: 'pointer',
    color: '#111827',
    boxShadow: '0 3px 9px rgba(31, 58, 95, 0.07)',
  },

  valuePill: {
    minWidth: 58,
    textAlign: 'center' as const,
    padding: '10px 12px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.88)',
    border: '1px solid rgba(229, 231, 235, 0.7)',
    fontWeight: 900,
    color: '#1F3A5F',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  noteToggle: {
    minHeight: 44,
    marginTop: 6,
    marginLeft: -10,
    padding: '8px 10px',
    border: 0,
    borderRadius: 10,
    background: 'transparent',
    fontSize: 12,
    fontWeight: 850,
    textAlign: 'left',
  },

  notesPanel: {
    marginTop: 10,
    padding: 11,
    borderRadius: 16,
    border: '1px solid #D8EAF7',
    background: '#F5FAFE',
  },

  notesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },

  notesTitle: {
    color: '#1F3A5F',
    fontSize: 13,
    fontWeight: 900,
  },

  noteClose: {
    minHeight: 36,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#1F3A5F',
    fontSize: 12,
    fontWeight: 850,
  },

  noteError: {
    marginTop: 8,
    padding: '9px 10px',
    borderRadius: 11,
    border: '1px solid #FECACA',
    background: '#FEF2F2',
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: 750,
  },
})
