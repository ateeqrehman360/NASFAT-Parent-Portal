'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ui } from '@/components/ManagementUI'
import { attendanceRegisterDate, isSaturdayDate, nextSaturdayDate } from '@/lib/attendance'
import { managementPost, managementRequest } from '@/lib/adminManagementClient'
import { supabase } from '@/lib/supabaseClient'

type EditorRole = 'admin' | 'staff'

type ClassRow = {
  id: string
  name: string
}

type AttendanceStudent = {
  id: string
  first_name: string
  last_name: string | null
  attendance_started_on: string | null
}

type AttendanceData = {
  classes: ClassRow[]
  selected_class_id: string
  students: AttendanceStudent[]
  present_student_ids: string[]
}

function studentName(student: AttendanceStudent) {
  return `${student.first_name}${student.last_name ? ` ${student.last_name}` : ''}`
}

function formatClassDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function classDateHasClosed(value: string) {
  const classDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(classDate.getTime())) return false
  classDate.setDate(classDate.getDate() + 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= classDate
}

export default function AttendanceManagementPage() {
  const router = useRouter()
  const [role, setRole] = useState<EditorRole | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [classDate, setClassDate] = useState(attendanceRegisterDate)
  const [students, setStudents] = useState<AttendanceStudent[]>([])
  const [presentIds, setPresentIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const checkAccess = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!active) return
      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!active) return
      if (profileError || (profile?.role !== 'admin' && profile?.role !== 'staff')) {
        router.replace('/login')
        return
      }

      setRole(profile.role)
    }

    void checkAccess()
    return () => { active = false }
  }, [router])

  useEffect(() => {
    if (!role) return
    if (!isSaturdayDate(classDate)) {
      setStudents([])
      setPresentIds(new Set())
      setDirty(false)
      setLoading(false)
      setError('Choose a Saturday for the attendance register.')
      return
    }

    const controller = new AbortController()
    let active = true

    const loadRegister = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ resource: 'attendance-management', class_date: classDate })
        if (selectedClassId) params.set('class_id', selectedClassId)
        const data = await managementRequest<AttendanceData>(`?${params.toString()}`, { signal: controller.signal })
        if (!active) return
        setClasses(data.classes)
        setSelectedClassId(data.selected_class_id)
        setStudents(data.students)
        setPresentIds(new Set(data.present_student_ids))
        setDirty(false)
      } catch (loadError) {
        if (!active || controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load attendance.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadRegister()
    return () => {
      active = false
      controller.abort()
    }
  }, [classDate, refreshKey, role, selectedClassId])

  const eligibleStudents = useMemo(
    () => students.filter((student) => student.attendance_started_on && student.attendance_started_on <= classDate),
    [classDate, students],
  )
  const eligibleIds = useMemo(() => new Set(eligibleStudents.map((student) => student.id)), [eligibleStudents])
  const presentCount = useMemo(() => [...presentIds].filter((studentId) => eligibleIds.has(studentId)).length, [eligibleIds, presentIds])
  const validClassDate = isSaturdayDate(classDate)
  const closed = classDateHasClosed(classDate)

  const toggleStudent = (studentId: string) => {
    if (!eligibleIds.has(studentId)) return
    setPresentIds((current) => {
      const next = new Set(current)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
    setDirty(true)
    setMessage(null)
  }

  const markAll = () => {
    setPresentIds(new Set(eligibleStudents.map((student) => student.id)))
    setDirty(true)
    setMessage(null)
  }

  const clearAll = () => {
    setPresentIds(new Set())
    setDirty(true)
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await managementPost<{ present_count: number; student_count: number }>({
        action: 'save-attendance',
        class_id: selectedClassId,
        class_date: classDate,
        present_student_ids: [...presentIds].filter((studentId) => eligibleIds.has(studentId)),
      })
      setMessage(`Register saved: ${result.present_count} of ${result.student_count} marked present.`)
      setDirty(false)
      setRefreshKey((current) => current + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save attendance.')
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return <main className="nasfat-app" style={ui.page}><div style={ui.content}>
    <header className="nasfat-surface nasfat-enter" style={ui.header}>
      <div style={ui.headerCopy}>
        <div style={ui.eyebrow}>Weekly register</div>
        <h1 data-heading="true" style={{ ...ui.title, margin: 0 }}>Saturday attendance</h1>
        <div data-body="true" style={ui.subtitle}>Mark the students who attended class. Unmarked students count as absent from Sunday.</div>
      </div>
      <div style={ui.headerActions}>
        {role === 'admin'
          ? <button className="nasfat-button" type="button" onClick={() => router.push('/admin')} style={ui.button}>← Admin</button>
          : <><button className="nasfat-button" type="button" onClick={() => router.push('/staff')} style={ui.button}>← Points</button><button className="nasfat-button" type="button" onClick={signOut} style={ui.button}>Log out</button></>}
        <button className="nasfat-button" type="button" onClick={() => router.push('/admin/exams')} style={ui.button}>Exam results</button>
        <Image className="nasfat-logo" src="/nasfat-logo.png" alt="NASFAT Manchester" width={46} height={46} priority style={ui.logo} />
      </div>
    </header>

    <section className="nasfat-surface nasfat-enter" style={ui.card}>
      <div style={ui.cardHeader}>
        <div>
          <h2 style={{ ...ui.cardTitle, margin: 0 }}>Choose the class and Saturday</h2>
          <div data-body="true" style={ui.hint}>You can reopen any Saturday to correct the saved register later.</div>
        </div>
        <span className="nasfat-number" style={ui.countPill}>{presentCount}/{eligibleStudents.length} present</span>
      </div>

      <div style={controlGrid}>
        <label htmlFor="attendance-class" style={ui.label}>Class
          <select id="attendance-class" name="class_id" value={selectedClassId} disabled={loading || !classes.length} onChange={(event) => { setSelectedClassId(event.target.value); setMessage(null) }} style={ui.input}>
            {classes.length === 0 && <option value="">No classes available</option>}
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label htmlFor="attendance-date" style={ui.label}>Class date
          <input id="attendance-date" name="class_date" type="date" max={nextSaturdayDate()} value={classDate} onChange={(event) => { setClassDate(event.target.value); setMessage(null) }} style={ui.input} />
        </label>
      </div>

      <div className="nasfat-status" style={infoCard}>
        <b>{formatClassDate(classDate)}</b>
        <span style={infoDetail}>{!validClassDate ? 'Attendance can only be recorded for Saturday classes.' : closed ? 'This class is already included in the attendance percentage.' : 'This class will be included in the percentage from Sunday.'}</span>
      </div>
    </section>

    {message && <div className="nasfat-status" role="status" aria-live="polite" style={ui.status}>{message}</div>}
    {error && <div className="nasfat-status" role="alert" style={ui.error}>{error}</div>}

    <section className="nasfat-surface nasfat-enter" style={ui.card} aria-busy={loading || saving}>
      <div style={ui.cardHeader}>
        <div>
          <h2 style={{ ...ui.cardTitle, margin: 0 }}>Class register</h2>
          <div data-body="true" style={ui.hint}>Tick everyone who was present. Leaving a student unticked records an absence automatically.</div>
        </div>
        <span style={{ ...ui.countPill, ...(dirty ? dirtyPill : {}) }}>{dirty ? 'Unsaved changes' : 'Up to date'}</span>
      </div>

      <div style={ui.actions}>
        <button className="nasfat-button" type="button" disabled={!validClassDate || loading || saving || !eligibleStudents.length} onClick={markAll} style={ui.button}>Mark all present</button>
        <button className="nasfat-button" type="button" disabled={!validClassDate || loading || saving || !eligibleStudents.length} onClick={clearAll} style={ui.button}>Clear all</button>
      </div>

      {!validClassDate ? (
        <div className="nasfat-status" style={ui.status}>Choose a Saturday to load the class register.</div>
      ) : loading ? (
        <div className="nasfat-status" style={ui.status}><span className="nasfat-spinner" aria-hidden="true" />Loading register…</div>
      ) : students.length === 0 ? (
        <div className="nasfat-status" style={ui.status}>There are no active students in this class.</div>
      ) : (
        <div style={ui.checklist}>
          {students.map((student) => {
            const eligible = eligibleIds.has(student.id)
            const present = presentIds.has(student.id) && eligible
            return <label className="nasfat-row nasfat-stagger" key={student.id} style={{ ...attendanceRow, ...(present ? ui.checkboxRowSelected : {}), ...(!eligible ? ineligibleRow : {}) }}>
              <input type="checkbox" checked={present} disabled={!eligible || saving} onChange={() => toggleStudent(student.id)} style={ui.checkbox} />
              <span style={studentCopy}>
                <span style={ui.checkboxName}>{studentName(student)}</span>
                <span style={ui.checkboxMeta}>{eligible ? (present ? 'Marked present' : closed ? 'Absent' : 'Not marked') : `Attendance starts ${student.attendance_started_on ?? 'when assigned'}`}</span>
              </span>
              <span className="nasfat-number" style={{ ...registerStatus, ...(present ? presentStatus : {}) }}>{eligible ? (present ? 'Present' : closed ? 'Absent' : '-') : 'Later'}</span>
            </label>
          })}
        </div>
      )}

      <button className="nasfat-button nasfat-full-button-mobile" type="button" disabled={!validClassDate || loading || saving || !selectedClassId || !eligibleStudents.length || !dirty} onClick={save} style={{ ...ui.primary, width: '100%', marginTop: 16, opacity: !validClassDate || loading || saving || !selectedClassId || !eligibleStudents.length || !dirty ? .65 : 1 }}>
        {saving ? <><span className="nasfat-spinner" aria-hidden="true" />Saving register…</> : `Save attendance (${presentCount} present)`}
      </button>
    </section>
  </div></main>
}

const controlGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0 12px' }
const infoCard: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14, padding: 13, borderRadius: 15, background: '#F5FAFE', border: '1px solid #D8EAF7', color: '#1F3A5F' }
const infoDetail: CSSProperties = { color: '#64748B', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }
const attendanceRow: CSSProperties = { minHeight: 62, marginTop: 0, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }
const ineligibleRow: CSSProperties = { opacity: .66, cursor: 'not-allowed', background: '#F8FAFC', borderStyle: 'dashed' }
const studentCopy: CSSProperties = { minWidth: 0, flex: 1 }
const registerStatus: CSSProperties = { flexShrink: 0, minWidth: 58, padding: '5px 8px', borderRadius: 999, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B', textAlign: 'center', fontSize: 11, fontWeight: 900 }
const presentStatus: CSSProperties = { background: '#EAF4FB', border: '1px solid #9ED1EC', color: '#1F3A5F' }
const dirtyPill: CSSProperties = { background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412' }
