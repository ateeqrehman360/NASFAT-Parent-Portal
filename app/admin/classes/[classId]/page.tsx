'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { managementPost } from '@/lib/adminManagementClient'
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
  created_at: string | null
}

type EditorRole = 'admin' | 'staff'

const MIN_DAILY_POINTS = -2
const MAX_DAILY_POINTS = 2

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
  const [deletingNoteIds, setDeletingNoteIds] = useState<Record<string, boolean>>({})
  const [noteDeleteErrors, setNoteDeleteErrors] = useState<Record<string, string | null>>({})

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

  const clampPoints = (n: number) => Math.max(MIN_DAILY_POINTS, Math.min(MAX_DAILY_POINTS, n))

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

  const deleteStudentNote = async (note: StudentNote, studentId: string, studentName: string) => {
    if (role !== 'admin' || deletingNoteIds[note.id]) return
    if (!window.confirm(`Delete this note for ${studentName}? Parents will no longer be able to see it.`)) return

    setDeletingNoteIds((current) => ({ ...current, [note.id]: true }))
    setNoteDeleteErrors((current) => ({ ...current, [note.id]: null }))
    try {
      await managementPost({ action: 'delete-student-note', note_id: note.id })
      setNotesByStudent((current) => ({
        ...current,
        [studentId]: (current[studentId] ?? []).filter((item) => item.id !== note.id),
      }))
    } catch (error) {
      setNoteDeleteErrors((current) => ({
        ...current,
        [note.id]: error instanceof Error ? error.message : 'The note could not be deleted.',
      }))
    } finally {
      setDeletingNoteIds((current) => ({ ...current, [note.id]: false }))
    }
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
            const currentPoints = points[s.id] ?? 0

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
                          style={S.existingNote}
                        >
                          <div style={S.noteAdminRow}>
                            <span className="nasfat-number" style={S.noteDate}>{n.created_at ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(n.created_at)) : 'Date not recorded'}</span>
                            {role === 'admin' && <button
                              className="nasfat-button"
                              type="button"
                              disabled={deletingNoteIds[n.id]}
                              onClick={() => void deleteStudentNote(n, s.id, name)}
                              style={S.deleteNoteButton}
                              aria-label={`Delete note for ${name}`}
                            >
                              {deletingNoteIds[n.id] ? 'Deleting…' : 'Delete'}
                            </button>}
                          </div>
                          {n.title && (
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                marginBottom: 4,
                              }}
                            >
                              {n.title}
                            </div>
                          )}
                          <div style={{ fontSize: 13 }}>{n.content}</div>
                          {noteDeleteErrors[n.id] && <div className="nasfat-status" role="alert" style={S.noteError}>{noteDeleteErrors[n.id]}</div>}
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

                          const { data: insertedNote, error } = await supabase.from('student_notes')
                            .insert({ student_id: s.id, content, created_by: user?.id })
                            .select('id, student_id, title, content, created_at')
                            .single()

                          if (error) {
                            console.error('Note insert error:', error)
                            setNoteStatus((n) => ({ ...n, [s.id]: 'error' }))
                            return
                          }

                          // success
                          setNewNote((n) => ({ ...n, [s.id]: '' }))
                          setNotesByStudent((current) => ({
                            ...current,
                            [s.id]: [insertedNote as StudentNote, ...(current[s.id] ?? [])],
                          }))
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
                    disabled={currentPoints <= MIN_DAILY_POINTS}
                    style={{ ...S.ctrlBtn, ...(currentPoints <= MIN_DAILY_POINTS ? S.ctrlBtnDisabled : {}) }}
                    onClick={() =>
                      setPoints((p) => ({
                        ...p,
                        [s.id]: clampPoints((p[s.id] ?? 0) - 1),
                      }))
                    }
                  >
                    -
                  </button>

                  <div className="nasfat-number" aria-live="polite" aria-label={`${currentPoints} points`} style={S.valuePill}>{currentPoints}</div>

                  <button
                    className="nasfat-button"
                    type="button"
                    aria-label={`Add one point to ${name}`}
                    disabled={currentPoints >= MAX_DAILY_POINTS}
                    style={{ ...S.ctrlBtn, ...(currentPoints >= MAX_DAILY_POINTS ? S.ctrlBtnDisabled : {}) }}
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
    color: '#1D2939',
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
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(186, 203, 218, 0.82)',
    borderRadius: 20,
    padding: isMobile ? 14 : 18,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 7px 20px rgba(31, 58, 95, 0.06)',
  },

  backBtn: {
    background: '#FFFFFF',
    border: '1px solid #B9C8D7',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 800,
    cursor: 'pointer',
    color: '#1F3A5F',
  },

  headerTitle: {
    margin: 0,
    fontSize: isMobile ? 19 : 23,
    fontWeight: 800,
    color: '#1F3A5F',
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
  },

  eyebrow: {
    marginBottom: 5,
    color: '#4E83A5',
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.2,
  },

  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#526277',
    fontWeight: 500,
  },

  stickyBar: {
    position: 'sticky',
    zIndex: 4,
    top: 10,
    marginTop: 14,
    background: '#F0F8FD',
    border: '1px solid #CFE6F6',
    borderRadius: 18,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    boxShadow: '0 7px 20px rgba(31, 58, 95, 0.08)',
  },

  mutedLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: '#1F3A5F',
    opacity: 0.75,
  },

  todayBig: {
    fontSize: 20,
    fontWeight: 800,
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
    background: '#1F3A5F',
    color: '#FFFFFF',
    border: '1px solid #152C4A',
    borderRadius: 12,
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 800,
    width: isMobile ? '100%' : undefined,
    boxShadow: '0 5px 12px rgba(31, 58, 95, 0.16)',
  },

  card: {
    marginTop: 14,
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(186, 203, 218, 0.72)',
    borderRadius: 20,
    padding: isMobile ? 16 : 18,
    color: '#1D2939',
    boxShadow: '0 7px 20px rgba(31, 58, 95, 0.055)',
  },

  grid: {
    marginTop: 14,
    display: 'grid',
    gap: 10,
  },

  studentRow: {
    background: '#FFFFFF',
    border: '1px solid #D6E0EA',
    borderRadius: 16,
    padding: isMobile ? 15 : 16,
    color: '#1D2939',
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center',
    gap: 14,
  },

  studentName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#1F3A5F',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: isMobile ? '100%' : 300,
  },

  studentMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#526277',
    fontWeight: 500,
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
    borderRadius: 12,
    border: '1px solid #B9C8D7',
    background: '#FFFFFF',
    fontSize: 20,
    fontWeight: 800,
    cursor: 'pointer',
    color: '#1F3A5F',
  },

  ctrlBtnDisabled: {
    background: '#F8FAFC',
    color: '#94A3B8',
    opacity: 0.58,
  },

  valuePill: {
    minWidth: 58,
    textAlign: 'center' as const,
    padding: '10px 12px',
    borderRadius: 12,
    background: '#EEF7FC',
    border: '1px solid #CFE6F6',
    fontWeight: 800,
    color: '#1F3A5F',
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
    fontWeight: 800,
    textAlign: 'left',
  },

  existingNote: {
    marginBottom: 8,
    padding: 11,
    borderRadius: 12,
    border: '1px solid #D6E0EA',
    background: '#FFFFFF',
  },

  noteAdminRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 7,
  },

  noteDate: {
    color: '#526277',
    fontSize: 11,
    fontWeight: 800,
  },

  deleteNoteButton: {
    minHeight: 44,
    padding: '8px 12px',
    borderRadius: 11,
    border: '1px solid #FECACA',
    background: '#FFF1F2',
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: 800,
  },

  notesPanel: {
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
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
    fontWeight: 800,
  },

  noteClose: {
    minHeight: 36,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#1F3A5F',
    fontSize: 12,
    fontWeight: 800,
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
