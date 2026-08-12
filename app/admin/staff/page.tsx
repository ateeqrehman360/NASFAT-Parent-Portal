'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ManagementPage, ui } from '@/components/ManagementUI'
import { managementPost, managementRequest } from '@/lib/adminManagementClient'

type StaffMember = {
  id: string
  username: string
  active: boolean
}

const blank = { username: '', password: '' }

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await managementRequest<{ staff: StaffMember[] }>('?resource=staff')
      setStaff(data.staff)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return staff.filter((member) => member.active === !showArchived && member.username.toLowerCase().includes(needle))
  }, [search, showArchived, staff])

  const resetForm = () => {
    setEditing(null)
    setForm(blank)
    setShowPassword(false)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await managementPost(editing
        ? { action: 'update-staff', staff_id: editing.id, username: form.username, new_password: form.password }
        : { action: 'create-staff', username: form.username, temporary_password: form.password })
      setMessage(editing ? 'Staff account updated.' : 'Staff account created. You can now share the username and temporary password.')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save staff account.')
    } finally {
      setSaving(false)
    }
  }

  const edit = (member: StaffMember) => {
    setEditing(member)
    setForm({ username: member.username, password: '' })
    setShowPassword(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setStaffActive = async (member: StaffMember, active: boolean) => {
    const verb = active ? 'restore' : 'archive'
    const access = active ? 'be able to sign in again' : 'no longer be able to sign in'
    if (!window.confirm(`Are you sure you want to ${verb} ${member.username}? They will ${access}, but their account history will be kept.`)) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await managementPost({ action: 'set-staff-active', staff_id: member.id, active })
      setMessage(active ? 'Staff account restored.' : 'Staff account archived.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update staff account.')
    } finally {
      setSaving(false)
    }
  }

  return <ManagementPage title="Staff management" subtitle="Create staff logins, correct usernames, reset passwords, and manage access.">
    <section className="nasfat-surface nasfat-enter" style={ui.card}>
      <div style={ui.cardHeader}>
        <div>
          <h2 style={{ ...ui.cardTitle, margin: 0 }}>{editing ? 'Edit staff account' : 'Create staff account'}</h2>
          <div data-body="true" style={ui.hint}>
            {editing
              ? 'Change the login username or enter a new password. Leave the password blank to keep it unchanged.'
              : 'Staff can enter exam results and mark attendance using the login you create here.'}
          </div>
        </div>
        {editing && <span className="nasfat-status" style={ui.countPill}>Editing</span>}
      </div>

      <form onSubmit={save} aria-busy={saving}>
        <label htmlFor="staff-username" style={ui.label}>
          Username
          <input
            id="staff-username"
            name="username"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-zA-Z0-9._-]+"
            autoCapitalize="none"
            autoComplete="username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            style={ui.input}
          />
        </label>

        <div style={ui.label}>
          <label htmlFor="staff-password">{editing ? 'New password (optional)' : 'Temporary password'}</label>
          <span style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
            <input
              id="staff-password"
              name={editing ? 'new_password' : 'temporary_password'}
              required={!editing}
              minLength={8}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              style={ui.input}
            />
            <button
              className="nasfat-button"
              type="button"
              aria-controls="staff-password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
              style={{ ...ui.button, minHeight: 50 }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </div>

        <div style={ui.actions}>
          <button className="nasfat-button nasfat-full-button-mobile" disabled={saving} style={{ ...ui.primary, opacity: saving ? .7 : 1 }}>
            {saving ? <><span className="nasfat-spinner" aria-hidden="true" />Saving…</> : editing ? 'Save changes' : 'Create staff account'}
          </button>
          {editing && <button className="nasfat-button" type="button" onClick={resetForm} style={ui.button}>Cancel</button>}
        </div>
      </form>
    </section>

    {message && <div className="nasfat-status" role="status" style={ui.status}>{message}</div>}
    {error && <div className="nasfat-status" role="alert" style={ui.error}>{error}</div>}

    <section className="nasfat-surface nasfat-enter" style={ui.card}>
      <div style={ui.cardHeader}>
        <div>
          <h2 style={{ ...ui.cardTitle, margin: 0 }}>{showArchived ? 'Archived staff accounts' : 'Active staff accounts'}</h2>
          <div style={ui.hint}>Archived staff cannot sign in and can be restored later.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="nasfat-number" style={ui.countPill}>{loading ? 'Loading…' : `${filtered.length} shown`}</span>
          <button className="nasfat-button" type="button" onClick={() => setShowArchived((current) => !current)} style={ui.button}>
            {showArchived ? 'View active' : 'View archived'}
          </button>
        </div>
      </div>

      <input
        id="staff-search"
        name="staff_search"
        aria-label="Search staff accounts"
        placeholder="Search by username"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={ui.search}
      />

      {loading
        ? <div className="nasfat-status" style={ui.status}><span className="nasfat-spinner" aria-hidden="true" />Loading staff accounts…</div>
        : filtered.length === 0
          ? <div className="nasfat-status" style={ui.status}>No {showArchived ? 'archived' : 'active'} staff accounts found.</div>
          : filtered.map((member) => <article className="nasfat-row nasfat-stagger" key={member.id} style={ui.row}>
            <div style={ui.rowHeader}>
              <div style={ui.rowTitle}>{member.username}</div>
              <span style={ui.countPill}>{member.active ? 'Active' : 'Archived'}</span>
            </div>
            <div style={ui.hint}>Can enter exam results and mark the Saturday attendance register.</div>
            <div style={ui.actions}>
              <button className="nasfat-button" type="button" onClick={() => edit(member)} style={ui.button}>Edit account</button>
              <button
                className="nasfat-button"
                type="button"
                disabled={saving}
                onClick={() => setStaffActive(member, !member.active)}
                style={{ ...(member.active ? ui.danger : ui.primary), opacity: saving ? .7 : 1 }}
              >
                {member.active ? 'Archive' : 'Restore'}
              </button>
            </div>
          </article>)}
    </section>
  </ManagementPage>
}
