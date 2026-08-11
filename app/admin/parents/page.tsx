'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ManagementPage, ui } from '@/components/ManagementUI'
import { managementPost, managementRequest } from '@/lib/adminManagementClient'

type Student = {
  id: string
  first_name: string
  last_name: string | null
  class_id: string
  active: boolean
}

type Parent = {
  id: string
  username: string
  active: boolean
  student_ids: string[]
  students: { id: string; name: string; active: boolean }[]
}

const blank = { username: '', temporary_password: '', student_ids: [] as string[] }

export default function ParentsManagementPage() {
  const [parents, setParents] = useState<Parent[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<Parent | null>(null)
  const [search, setSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudentPicker, setShowStudentPicker] = useState(false)
  const [showArchivedStudents, setShowArchivedStudents] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [parentData, formData] = await Promise.all([
        managementRequest<{ parents: Parent[] }>('?resource=parents'),
        managementRequest<{ students: Student[] }>('?resource=parent-form'),
      ])
      setParents(parentData.parents)
      setStudents(formData.students)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load parents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => parents.filter((parent) => {
    const matchesSearch = `${parent.username} ${parent.students.map((student) => student.name).join(' ')}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
    return matchesSearch && parent.active === !showArchived
  }), [parents, search, showArchived])

  const selectedStudents = useMemo(() => students.filter((student) => form.student_ids.includes(student.id)), [students, form.student_ids])
  const selectableStudents = useMemo(() => {
    const needle = studentSearch.trim().toLowerCase()
    return students.filter((student) => {
      const selected = form.student_ids.includes(student.id)
      const matchesSearch = !needle || `${student.first_name} ${student.last_name ?? ''}`.toLowerCase().includes(needle)
      return matchesSearch && (student.active || selected || showArchivedStudents)
    })
  }, [students, form.student_ids, studentSearch, showArchivedStudents])

  const resetForm = () => {
    setEditing(null)
    setForm(blank)
    setStudentSearch('')
    setShowStudentPicker(false)
    setShowArchivedStudents(false)
  }

  const toggleStudent = (id: string) => {
    setForm((current) => ({
      ...current,
      student_ids: current.student_ids.includes(id)
        ? current.student_ids.filter((studentId) => studentId !== id)
        : [...current.student_ids, id],
    }))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await managementPost(editing
        ? { action: 'update-parent', parent_id: editing.id, username: form.username, student_ids: form.student_ids }
        : { action: 'create-parent', ...form })
      setMessage(editing ? 'Parent account updated.' : 'Parent account created and linked.')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save parent account.')
    } finally {
      setSaving(false)
    }
  }

  const edit = (parent: Parent) => {
    setEditing(parent)
    setForm({ username: parent.username, temporary_password: '', student_ids: parent.student_ids })
    setStudentSearch('')
    setShowStudentPicker(false)
    setShowArchivedStudents(parent.students.some((student) => !student.active))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setParentActive = async (parent: Parent, active: boolean) => {
    const verb = active ? 'restore' : 'archive'
    const access = active ? 'be able to sign in again' : 'no longer be able to sign in'
    if (!window.confirm(`Are you sure you want to ${verb} ${parent.username}? They will ${access}, but their linked students and history will be kept.`)) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await managementPost({ action: 'set-parent-active', parent_id: parent.id, active })
      setMessage(active ? 'Parent account restored.' : 'Parent account archived.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update parent account.')
    } finally {
      setSaving(false)
    }
  }

  return <ManagementPage title="Parent management" subtitle="Create, update, archive, and restore parent logins.">
    <section style={ui.card}>
      <div style={ui.cardHeader}><div><div style={ui.cardTitle}>{editing ? 'Edit parent links' : 'Create parent account'}</div><div style={ui.hint}>{editing ? 'Change the username or linked students.' : 'The parent will sign in with this username and temporary password.'}</div></div>{editing && <span style={ui.countPill}>Editing</span>}</div>
      <form onSubmit={save} aria-busy={saving}>
        <label style={ui.label}>
          Username
          <input
            required
            autoCapitalize="none"
            autoComplete="username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            style={ui.input}
          />
        </label>
        {!editing && <label style={ui.label}>
          Temporary password
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={form.temporary_password}
            onChange={(event) => setForm({ ...form, temporary_password: event.target.value })}
            style={ui.input}
          />
        </label>}
        <div style={ui.fieldHeader}>
          <div>
            <div style={{ ...ui.label, marginTop: 0 }}>Linked students</div>
            <div style={ui.hint}>{selectedStudents.length ? `${selectedStudents.length} student${selectedStudents.length === 1 ? '' : 's'} selected.` : 'Optional — link a student now or add the link later.'}</div>
          </div>
          <button type="button" aria-expanded={showStudentPicker} aria-controls="student-link-picker" onClick={() => setShowStudentPicker((current) => !current)} style={ui.button}>{showStudentPicker ? 'Done selecting' : 'Choose students'}</button>
        </div>
        {selectedStudents.length > 0 && <div style={ui.selectionSummary} aria-live="polite"><b>Selected:</b> {selectedStudents.map((student) => `${student.first_name}${student.last_name ? ` ${student.last_name}` : ''}`).join(', ')}</div>}
        {showStudentPicker && <div id="student-link-picker">
          <div style={ui.pickerToolbar}>
            <input aria-label="Find a student to link" placeholder="Find a student" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} style={{ ...ui.search, marginTop: 0, flex: '1 1 190px' }} />
            <button type="button" onClick={() => setShowArchivedStudents((current) => !current)} style={ui.button}>{showArchivedStudents ? 'Hide archived' : 'Show archived'}</button>
          </div>
          <div style={ui.checklist}>
            {selectableStudents.length === 0 ? <div style={ui.status}>No students match that search.</div> : selectableStudents.map((student) => {
              const checked = form.student_ids.includes(student.id)
              return <label key={student.id} style={{ ...ui.checkboxRow, ...(!student.active ? ui.checkboxRowArchived : {}), ...(checked ? ui.checkboxRowSelected : {}) }}>
                <input type="checkbox" checked={checked} onChange={() => toggleStudent(student.id)} style={ui.checkbox} />
                <span style={{ minWidth: 0, flex: 1 }}><span style={ui.checkboxName}>{student.first_name} {student.last_name}</span><span style={ui.checkboxMeta}>{student.active ? 'Active student' : 'Archived student'}</span></span>
              </label>
            })}
          </div>
        </div>}
        <div style={ui.actions}>
          <button disabled={saving} style={{ ...ui.primary, opacity: saving ? .7 : 1 }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create parent account'}</button>
          {editing && <button type="button" onClick={resetForm} style={ui.button}>Cancel</button>}
        </div>
      </form>
    </section>

    {message && <div role="status" style={ui.status}>{message}</div>}
    {error && <div role="alert" style={ui.error}>{error}</div>}

    <section style={ui.card}>
      <div style={ui.cardHeader}>
        <div>
          <div style={ui.cardTitle}>{showArchived ? 'Archived parent accounts' : 'Active parent accounts'}</div>
          <div style={ui.hint}>Archived parents keep their links and can be restored later.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={ui.countPill}>{loading ? 'Loading…' : `${filtered.length} shown`}</span><button type="button" onClick={() => setShowArchived((current) => !current)} style={ui.button}>{showArchived ? 'View active' : 'View archived'}</button></div>
      </div>
      <input
        aria-label="Search parents"
        placeholder="Search username or linked student"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={ui.search}
      />
      {loading ? <div style={ui.status}>Loading parent accounts…</div>
        : filtered.length === 0 ? <div style={ui.status}>No {showArchived ? 'archived' : 'active'} parent accounts found.</div>
          : filtered.map((parent) => <article key={parent.id} style={ui.row}>
            <div style={ui.rowHeader}><div style={ui.rowTitle}>{parent.username}</div><span style={ui.countPill}>{parent.students.length} linked</span></div>
            <div style={ui.hint}>
              {parent.students.length
                ? parent.students.map((student) => student.name + (student.active ? '' : ' (archived)')).join(', ')
                : 'No students linked yet.'}
            </div>
            <div style={ui.actions}>
              <button type="button" onClick={() => edit(parent)} style={ui.button}>Edit links</button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setParentActive(parent, !parent.active)}
                style={{ ...(parent.active ? ui.danger : ui.primary), opacity: saving ? .7 : 1 }}
              >
                {parent.active ? 'Archive' : 'Restore'}
              </button>
            </div>
          </article>)}
    </section>
  </ManagementPage>
}
