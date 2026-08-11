'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ManagementPage, ui } from '@/components/ManagementUI'
import { managementPost, managementRequest } from '@/lib/adminManagementClient'

type ClassRow = { id: string; name: string; active_student_count: number }

export default function ClassesManagementPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await managementRequest<{ classes: ClassRow[] }>('?resource=classes')
      setClasses(data.classes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load classes.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      await managementPost({ action: editing ? 'update-class' : 'create-class', class_id: editing?.id, name })
      setMessage(editing ? 'Class renamed.' : 'Class created.')
      setName('')
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save class.')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (item: ClassRow) => {
    if (!window.confirm(`Delete ${item.name}? This is only allowed when it has no active students.`)) return
    setSaving(true)
    setError(null)
    try {
      await managementPost({ action: 'delete-class', class_id: item.id })
      setMessage('Class deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete class.')
    } finally {
      setSaving(false)
    }
  }
  return <ManagementPage title="Class management" subtitle="Create, rename, and review class sizes.">
    <section style={ui.card}>
      <div style={ui.cardHeader}><div><div style={ui.cardTitle}>{editing ? 'Rename class' : 'Create class'}</div><div style={ui.hint}>{editing ? 'Use the name that teachers and admins will recognise.' : 'Classes are used for points logging and student placement.'}</div></div>{editing && <span style={ui.countPill}>Editing</span>}</div>
      <form onSubmit={save} aria-busy={saving}><label style={ui.label}>Class name<input required value={name} onChange={(e) => setName(e.target.value)} style={ui.input} /></label><div style={ui.actions}><button disabled={saving} style={{ ...ui.primary, opacity: saving ? .7 : 1 }}>{saving ? 'Saving…' : editing ? 'Save name' : 'Create class'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setName('') }} style={ui.button}>Cancel</button>}</div></form>
    </section>
    {message && <div role="status" style={ui.status}>{message}</div>}
    {error && <div role="alert" style={ui.error}>{error}</div>}
    <section style={ui.card}>
      <div style={ui.cardHeader}><div><div style={ui.cardTitle}>All classes</div><div style={ui.hint}>A class can only be deleted after its active students have been moved.</div></div><span style={ui.countPill}>{loading ? 'Loading…' : `${classes.length} total`}</span></div>
      {loading ? <div style={ui.status}>Loading classes…</div> : classes.length === 0 ? <div style={ui.status}>No classes yet.</div> : classes.map((item) => <article key={item.id} style={ui.row}><div style={ui.rowHeader}><div style={ui.rowTitle}>{item.name}</div><span style={ui.countPill}>{item.active_student_count} active</span></div><div style={ui.actions}><button type="button" onClick={() => { setEditing(item); setName(item.name); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={ui.button}>Rename</button>{item.active_student_count === 0 && <button type="button" disabled={saving} onClick={() => remove(item)} style={{ ...ui.danger, opacity: saving ? .7 : 1 }}>Delete</button>}</div></article>)}
    </section>
  </ManagementPage>
}
