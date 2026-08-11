'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
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

export default function ClassPage() {
  const { classId } = useParams<{ classId: string }>()
  const router = useRouter()

  const [students, setStudents] = useState<Student[]>([])
  const [points, setPoints] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState<Record<string, number>>({})

  const [notesByStudent, setNotesByStudent] = useState<Record<string, StudentNote[]>>({})
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const [newNote, setNewNote] = useState<Record<string, string>>({})
  const [noteStatus, setNoteStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

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
      if (profileError || profile?.role !== 'admin') {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const { data: studentData, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('class_id', classId)
        .eq('active', true)
        .order('first_name')

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
      setSaveMsg('❌ Save failed')
      return
    }

    setSaveMsg('✅ Saved for today')
  }

  if (loading) {
    return (
      <main>
        <div>Loading…</div>
      </main>
    )
  }

 const S = styles(isMobile)


return (
  <main style={S.page}>
    <div style={S.content}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <button onClick={() => router.push('/admin')} style={S.backBtn}>
            ← Back
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={S.headerTitle}>Class</div>
            <div style={S.headerSub}>Log points for today</div>
          </div>
        </div>

        <img
          src="/nasfat-logo.png"
          alt="NASFAT Manchester"
          style={S.headerLogo}
        />
      </div>

      <div style={S.stickyBar}>
        <div>
          <div style={S.mutedLabel}>Today</div>
          <div style={S.todayBig}>{todayISO}</div>
          {saveMsg && <div style={S.saveMsg}>{saveMsg}</div>}
        </div>

        <button
          onClick={handleSaveToday}
          disabled={saving}
          style={S.saveBtn}
        >
          {saving ? 'Saving…' : 'Save today'}
        </button>
      </div>

      {students.length === 0 ? (
        <div style={S.card}>No students in this class.</div>
      ) : (
        <div style={S.grid}>
          {students.map((s) => {
            const name = `${s.first_name}${s.last_name ? ` ${s.last_name}` : ''}`
            const notes = notesByStudent[s.id] ?? []
            const isOpen = openNotes[s.id]
            const status = noteStatus[s.id] ?? 'idle'

            return (
              <div key={s.id} style={S.studentRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={S.studentName}>{name}</div>
                  <div style={S.studentMeta}>
                    Total: {totals[s.id] ?? 0}
                  </div>

                  {/* Notes toggle */}
                  {!isOpen && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        color: notes.length > 0 ? '#B45309' : '#2563EB',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        setOpenNotes((o) => ({ ...o, [s.id]: true }))
                      }
                    >
                      {notes.length > 0 ? '🔔 View teacher notes' : '➕ Add a note'}
                    </div>
                  )}

                  {isOpen && (
                    <div style={{ marginTop: 10 }}>
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            background: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(229,231,235,0.7)',
                            borderRadius: 12,
                            padding: 10,
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
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          border: '1px solid rgba(209,213,219,1)',
                          fontSize: 13,
                          background: '#FFFFFF',
                          color: '#111827',
                          outline: 'none',
                        }}
                      />


                      <button
                        disabled={status === 'saving'}
                        style={{
                          marginTop: 6,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(209,213,219,1)',
                          background:
                            status === 'saved' ? '#16a34a' : '#1F3A5F',
                          transition: 'background 0.2s ease',
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
                            alert('Failed to add note. Check console.')
                            setNoteStatus((n) => ({ ...n, [s.id]: 'idle' }))
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
                          ? 'Saving…'
                          : status === 'saved'
                          ? 'Added ✓'
                          : 'Add note'
                          }
                      </button>
                    </div>
                  )}
                </div>

                <div style={S.controls}>
                  <button
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

                  <div style={S.valuePill}>{points[s.id] ?? 0}</div>

                  <button
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
              </div>
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
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)',
    color: '#111827',
    overflow: 'hidden',
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
    padding: isMobile ? 14 : 24,
  },

  // HEADER: slightly translucent but still readable
  header: {
    background: 'rgba(255, 255, 255, 0.90)',
    border: '1px solid rgba(229, 231, 235, 0.75)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  // Buttons should be SOLID (no "disabled" look)
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
    fontSize: 18,
    fontWeight: 900,
    color: '#1F3A5F',
  },

  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  // Sticky bar can stay a bit more opaque (info section)
  stickyBar: {
    marginTop: 14,
    background: 'rgba(234, 244, 251, 0.92)',
    border: '1px solid rgba(207, 230, 246, 0.95)',
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

  // Save button: SOLID + visible
  saveBtn: {
    background: '#1F3A5F',
    color: '#FFFFFF',
    border: '1px solid rgba(15, 23, 42, 0.2)',
    borderRadius: 14,
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 900,
    width: isMobile ? '100%' : undefined,
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

  grid: {
    marginTop: 14,
    display: 'grid',
    gap: 10,
  },

  // Student rows: MORE see-through so watermark actually shows "behind cards"
  studentRow: {
    background: 'rgba(255, 255, 255, 0.7)',
    border: '1px solid rgba(229, 231, 235, 0.68)',
    borderRadius: 18,
    padding: 14,
    color: '#111827',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  studentName: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1F3A5F',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: isMobile ? 150 : 260,
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
    gap: 10,
    flexShrink: 0,
  },

  // +/- buttons: solid, with clear border + visible text
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: '1px solid rgba(209, 213, 219, 1)',
    background: '#FFFFFF',
    fontSize: 20,
    fontWeight: 900,
    cursor: 'pointer',
    color: '#111827',
  },

  // value pill can be slightly translucent but still readable
  valuePill: {
    minWidth: 54,
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
})
