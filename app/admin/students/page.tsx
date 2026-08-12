'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ManagementPage, ui } from '@/components/ManagementUI'
import { managementPost, managementRequest } from '@/lib/adminManagementClient'
import { supabase } from '@/lib/supabaseClient'

type ClassRow = { id: string; name: string }
type Student = { id: string; first_name: string; last_name: string | null; class_id: string | null; active: boolean }
const emptyForm = { first_name: '', last_name: '', class_id: '' }

export default function StudentsManagementPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Student | null>(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      // Classes are readable by the existing admin client; keep the class picker
      // usable even if the server-only management configuration is incomplete.
      const { data: directClasses, error: directClassesError } = await supabase
        .from('classes').select('id, name').order('name')
      if (directClassesError) throw directClassesError
      const availableClasses = directClasses ?? []
      setClasses(availableClasses)

      const studentData = await managementRequest<{ students: Student[] }>('?resource=students')
      setStudents(studentData.students)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load student records.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const visible = useMemo(() => students.filter((student) => {
    const matchesSearch = `${student.first_name} ${student.last_name ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && student.active === !showArchived
  }), [students, search, showArchived])
  const totalInCurrentView = useMemo(() => students.filter((student) => student.active === !showArchived).length, [students, showArchived])
  const className = (classId: string | null) => classes.find((item) => item.id === classId)?.name ?? 'No class'

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null)
    try {
      await managementPost({ action: editing ? 'update-student' : 'create-student', student_id: editing?.id, student: form })
      setMessage(editing ? 'Student updated.' : 'Student added.')
      setEditing(null); setForm(emptyForm); await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save student.') }
    finally { setSaving(false) }
  }
  const setActive = async (student: Student, active: boolean) => {
    const verb = active ? 'restore' : 'archive'
    if (!window.confirm(`Are you sure you want to ${verb} ${student.first_name}? Their points and notes will be kept.`)) return
    setSaving(true); setError(null); setMessage(null)
    try { await managementPost({ action: 'set-student-active', student_id: student.id, active }); setMessage(active ? 'Student restored.' : 'Student archived.'); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update student.') }
    finally { setSaving(false) }
  }

  return <ManagementPage title="Student management" subtitle="Add, update, archive, and restore students.">
    <section style={ui.card}><div style={ui.cardHeader}><div><div style={ui.cardTitle}>{editing ? 'Edit student' : 'Add student'}</div><div style={ui.hint}>{editing ? 'Correct the student’s name or update their group, then save.' : 'A group can be left blank and added later.'}</div></div>{editing && <span style={ui.countPill}>Editing</span>}</div>
      <form onSubmit={save} aria-busy={saving}>
        <label style={ui.label}>First name<input required autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={ui.input} /></label>
        <label style={ui.label}>Last name<input autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={ui.input} /></label>
        <label style={ui.label}>Class (optional)<select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} style={ui.input}><option value="">No class yet</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div style={ui.actions}><button disabled={saving} style={{ ...ui.primary, opacity: saving ? .7 : 1 }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add student'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm) }} style={ui.button}>Cancel</button>}</div>
      </form>
      {!classes.length && <div style={ui.status}>No classes are available yet; the student can still be saved and assigned later.</div>}
    </section>
    {message && <div role="status" style={ui.status}>{message}</div>}{error && <div role="alert" style={ui.error}>{error}</div>}
    <section style={ui.card}><div style={ui.cardHeader}><div><div style={ui.cardTitle}>{showArchived ? 'Archived students' : 'Active students'}</div><div style={ui.hint}>Archived students keep their points and notes.</div></div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={ui.countPill}>{loading ? 'Loading…' : `${visible.length} shown`}</span><button type="button" onClick={() => setShowArchived((current) => !current)} style={ui.button}>{showArchived ? 'View active' : 'View archived'}</button></div></div>
      <input aria-label="Search students" placeholder="Search by student name" value={search} onChange={(e) => setSearch(e.target.value)} style={ui.search} />
      {loading ? <div style={ui.status}>Loading students…</div> : visible.length === 0 ? <div style={ui.status}>No {showArchived ? 'archived' : 'active'} students found.</div> : visible.map((student) => <article key={student.id} style={ui.row}><div style={ui.rowHeader}><div style={ui.rowTitle}>{student.first_name} {student.last_name}</div><span style={ui.countPill}>{className(student.class_id)}</span></div><div style={ui.actions}><button type="button" onClick={() => { setEditing(student); setForm({ first_name: student.first_name, last_name: student.last_name ?? '', class_id: student.class_id ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={ui.button}>Edit</button><button type="button" disabled={saving} onClick={() => setActive(student, !student.active)} style={{ ...(student.active ? ui.danger : ui.primary), opacity: saving ? .7 : 1 }}>{student.active ? 'Archive' : 'Restore'}</button></div></article>)}
      {!loading && visible.length > 0 && search.trim() && <div style={ui.hint}>{visible.length} of {totalInCurrentView} {showArchived ? 'archived' : 'active'} students match your search.</div>}
    </section>
  </ManagementPage>
}
