'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ui } from '@/components/ManagementUI'
import { managementPost, managementRequest } from '@/lib/adminManagementClient'
import { supabase } from '@/lib/supabaseClient'

type Score = number | string | null

type Student = {
  id: string
  first_name: string
  last_name: string | null
  class_id: string | null
  class_name: string
}

type ExamResult = {
  id: string
  student_id: string
  exam_date: string | null
  quran_score: Score
  quran_max_score: Score
  islamic_studies_score: Score
  islamic_studies_max_score: Score
  arabic_score: Score
  arabic_max_score: Score
  created_at: string
  updated_at: string
}

type EditorRole = 'admin' | 'staff'

const blankForm = {
  result_id: '',
  student_id: '',
  exam_month: '',
  quran_score: '',
  islamic_studies_score: '',
  arabic_score: '',
}

function studentName(student: Pick<Student, 'first_name' | 'last_name'>) {
  return `${student.first_name}${student.last_name ? ` ${student.last_name}` : ''}`
}

function displayScore(score: Score, maxScore: Score) {
  if (score === null || score === '') return '—'
  return maxScore === null || maxScore === '' ? String(score) : `${score}/${maxScore}`
}

function scoreInputValue(score: Score, maxScore: Score) {
  if (score === null || score === '') return ''
  return maxScore === null || maxScore === '' ? String(score) : `${score}/${maxScore}`
}

function displayMonth(date: string | null) {
  if (!date) return 'Month not recorded'
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(parsed)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function latestResultMonth(results: ExamResult[]) {
  return results.find((result) => result.exam_date)?.exam_date?.slice(0, 7) ?? currentMonth()
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

export default function ExamManagementPage() {
  const router = useRouter()
  const [role, setRole] = useState<EditorRole | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [results, setResults] = useState<ExamResult[]>([])
  const [form, setForm] = useState(blankForm)
  const [studentSearch, setStudentSearch] = useState('')
  const [resultSearch, setResultSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.replace('/login')
        return
      }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profileError || (profile?.role !== 'admin' && profile?.role !== 'staff')) {
        router.replace('/login')
        return
      }
      setRole(profile.role)
      const data = await managementRequest<{ students: Student[]; results: ExamResult[] }>('?resource=exam-management')
      setStudents(data.students)
      setResults(data.results)
      setForm((current) => ({
        ...current,
        student_id: current.student_id || data.students[0]?.id || '',
        exam_month: current.exam_month || latestResultMonth(data.results),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load exam results.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  const matchingStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    return students.filter((student) => student.id === form.student_id || !query || `${studentName(student)} ${student.class_name}`.toLowerCase().includes(query))
  }, [form.student_id, studentSearch, students])

  const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])
  const filteredResults = useMemo(() => {
    const query = resultSearch.trim().toLowerCase()
    return results.filter((result) => {
      const student = studentsById.get(result.student_id)
      return !query || `${student ? studentName(student) : ''} ${student?.class_name ?? ''} ${result.exam_date ?? ''} ${displayMonth(result.exam_date)}`.toLowerCase().includes(query)
    }).sort(compareExamResults)
  }, [resultSearch, results, studentsById])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const wasEditing = Boolean(form.result_id)
      const selectedStudentId = form.student_id
      await managementPost({ action: 'upsert-exam-result', ...form })
      await load()
      setForm({
        ...blankForm,
        student_id: selectedStudentId,
        exam_month: form.exam_month,
      })
      setMessage(wasEditing ? 'Exam result updated.' : 'Exam result saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save exam results.')
    } finally {
      setSaving(false)
    }
  }

  const edit = (result: ExamResult) => {
    setForm({
      result_id: result.id,
      student_id: result.student_id,
      exam_month: result.exam_date?.slice(0, 7) ?? '',
      quran_score: scoreInputValue(result.quran_score, result.quran_max_score),
      islamic_studies_score: scoreInputValue(result.islamic_studies_score, result.islamic_studies_max_score),
      arabic_score: scoreInputValue(result.arabic_score, result.arabic_max_score),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const clearForm = () => {
    setForm({ ...blankForm, student_id: students[0]?.id ?? '', exam_month: latestResultMonth(results) })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return <main className="nasfat-app" style={ui.page}><div style={ui.content}>
    <header className="nasfat-surface nasfat-enter" style={ui.header}>
      <div style={ui.headerCopy}><div style={ui.eyebrow}>Progress records</div><h1 data-heading="true" style={{ ...ui.title, margin: 0 }}>Exam results</h1><div data-body="true" style={ui.subtitle}>Record Quran, Islamic Studies, and Arabic exam scores.</div></div>
      <div style={ui.headerActions}>
        {role === 'admin'
          ? <><button className="nasfat-button" type="button" onClick={() => router.push('/admin')} style={ui.button}>← Admin</button><button className="nasfat-button" type="button" onClick={() => router.push('/admin/students')} style={ui.button}>Edit students</button></>
          : <button className="nasfat-button" type="button" onClick={signOut} style={ui.button}>Log out</button>}
        <button className="nasfat-button" type="button" onClick={() => router.push('/admin/attendance')} style={ui.button}>Attendance</button>
        <Image className="nasfat-logo" src="/nasfat-logo.png" alt="NASFAT Manchester" width={46} height={46} priority style={ui.logo} />
      </div>
    </header>

    <section className="nasfat-surface nasfat-enter" style={ui.card}>
      <div style={ui.cardHeader}><div><h2 style={{ ...ui.cardTitle, margin: 0 }}>{form.result_id ? 'Edit exam result' : 'Enter exam results'}</h2><div data-body="true" style={ui.hint}>Choose the exam month, then enter a mark as 35/40 to show the total. Missing subjects can be added later.</div></div><span style={ui.countPill}>{role === 'staff' ? 'Staff entry' : 'Admin entry'}</span></div>
      <form onSubmit={save} aria-busy={saving}>
        <label htmlFor="exam-student-search" style={ui.label}>Find student<input id="exam-student-search" name="student_search" aria-label="Find student" placeholder="Search by student or group" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} style={ui.input} /></label>
        <label htmlFor="exam-student" style={ui.label}>Student<select id="exam-student" name="student_id" required value={form.student_id} onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} style={ui.input}><option value="">Choose a student</option>{matchingStudents.map((student) => <option key={student.id} value={student.id}>{studentName(student)} — {student.class_name}</option>)}</select></label>
        <label htmlFor="exam-month" style={ui.label}>Exam month<input id="exam-month" name="exam_month" type="month" required value={form.exam_month} onChange={(event) => setForm((current) => ({ ...current, exam_month: event.target.value }))} style={ui.input} /></label>
        <div className="nasfat-score-form">
          <label htmlFor="quran-score" style={ui.label}>Quran<input id="quran-score" name="quran_score" inputMode="text" placeholder="e.g. 35/40" value={form.quran_score} onChange={(event) => setForm((current) => ({ ...current, quran_score: event.target.value }))} style={ui.input} /></label>
          <label htmlFor="islamic-studies-score" style={ui.label}>Islamic Studies<input id="islamic-studies-score" name="islamic_studies_score" inputMode="text" placeholder="e.g. 35/40" value={form.islamic_studies_score} onChange={(event) => setForm((current) => ({ ...current, islamic_studies_score: event.target.value }))} style={ui.input} /></label>
          <label htmlFor="arabic-score" style={ui.label}>Arabic<input id="arabic-score" name="arabic_score" inputMode="text" placeholder="e.g. 35/40" value={form.arabic_score} onChange={(event) => setForm((current) => ({ ...current, arabic_score: event.target.value }))} style={ui.input} /></label>
        </div>
        <div style={ui.actions}><button className="nasfat-button nasfat-full-button-mobile" disabled={saving || !students.length} style={{ ...ui.primary, opacity: saving || !students.length ? .7 : 1 }}>{saving ? <><span className="nasfat-spinner" aria-hidden="true" />Saving…</> : form.result_id ? 'Save changes' : 'Save exam results'}</button><button className="nasfat-button" type="button" onClick={clearForm} style={ui.button}>{form.result_id ? 'Cancel edit' : 'Clear form'}</button></div>
      </form>
      {!loading && !students.length && <div className="nasfat-status" style={ui.status}>There are no active students to enter results for.</div>}
    </section>

    {message && <div className="nasfat-status" role="status" style={ui.status}>{message}</div>}
    {error && <div className="nasfat-status" role="alert" style={ui.error}>{error}</div>}

    <section className="nasfat-surface nasfat-enter" style={ui.card}>
      <div style={ui.cardHeader}><div><h2 style={{ ...ui.cardTitle, margin: 0 }}>Recorded results</h2><div data-body="true" style={ui.hint}>The latest exam month is shown first. Older months remain available as history.</div></div><span className="nasfat-number" style={ui.countPill}>{loading ? 'Loading…' : `${filteredResults.length} shown`}</span></div>
      <input id="result-search" name="result_search" aria-label="Search recorded results" placeholder="Search by student, group, or month" value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} style={ui.search} />
      {loading ? <div className="nasfat-status" style={ui.status}><span className="nasfat-spinner" aria-hidden="true" />Loading results…</div> : filteredResults.length === 0 ? <div className="nasfat-status" style={ui.status}>No exam results have been recorded yet.</div> : filteredResults.map((result) => {
        const student = studentsById.get(result.student_id)
        return <article className="nasfat-row nasfat-stagger" key={result.id} style={ui.row}>
          <div style={ui.rowHeader}><div><div style={ui.rowTitle}>{student ? studentName(student) : 'Student record unavailable'}</div><div style={ui.hint}>{student?.class_name ?? 'No class'}</div></div><span style={ui.countPill}>{displayMonth(result.exam_date)}</span></div>
          <div className="nasfat-score-summary">
            <ScoreBox label="Quran" value={displayScore(result.quran_score, result.quran_max_score)} />
            <ScoreBox label="Islamic Studies" value={displayScore(result.islamic_studies_score, result.islamic_studies_max_score)} />
            <ScoreBox label="Arabic" value={displayScore(result.arabic_score, result.arabic_max_score)} />
          </div>
          <div style={ui.actions}><button className="nasfat-button" type="button" onClick={() => edit(result)} style={ui.button}>Edit results</button></div>
        </article>
      })}
    </section>
  </div></main>
}

function ScoreBox({ label, value }: { label: string; value: string }) {
  return <div style={scoreBox}><div style={scoreLabel}>{label}</div><div className="nasfat-number" style={scoreValue}>{value}</div></div>
}

const scoreBox: CSSProperties = { minWidth: 0, padding: '10px 8px', borderRadius: 14, background: '#F5FAFE', border: '1px solid #D8EAF7', textAlign: 'center' }
const scoreLabel: CSSProperties = { color: '#64748B', fontSize: 11, fontWeight: 800, lineHeight: 1.25 }
const scoreValue: CSSProperties = { marginTop: 5, color: '#1F3A5F', fontSize: 20, lineHeight: 1, fontWeight: 900, overflowWrap: 'anywhere' }
