import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { isSaturdayDate, nextSaturdayDate } from '@/lib/attendance'

export const runtime = 'nodejs'

type StudentInput = { first_name: string; last_name?: string | null; class_id?: string | null }
type ParsedExamScore = { score: number | null; maxScore: number | null }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = () => getSupabaseAdmin()
const parentArchiveDuration = '876000h'

function cleanUsername(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function studentName(student: { first_name: string; last_name: string | null }) {
  return `${student.first_name}${student.last_name ? ` ${student.last_name}` : ''}`
}

function authUserIsActive(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return true
  const timestamp = Date.parse(bannedUntil)
  return !Number.isNaN(timestamp) && timestamp <= Date.now()
}

async function requireRole(request: NextRequest, allowedRoles: string[]) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) return null
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', authData.user.id).single()
  return profile && allowedRoles.includes(profile.role) ? authData.user : null
}

function requireAdmin(request: NextRequest) { return requireRole(request, ['admin']) }
function requireExamEditor(request: NextRequest) { return requireRole(request, ['admin', 'staff']) }

function badRequest(message: string) { return NextResponse.json({ error: message }, { status: 400 }) }

function readScore(value: unknown): ParsedExamScore | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return { score: null, maxScore: null }
  const parts = raw.replace(/\s/g, '').split('/')
  if (parts.length > 2 || !parts[0] || (parts.length === 2 && !parts[1])) return undefined
  const score = Number(parts[0])
  const maxScore = parts.length === 2 ? Number(parts[1]) : null
  if (!Number.isFinite(score) || score < 0 || (maxScore !== null && (!Number.isFinite(maxScore) || maxScore <= 0 || score > maxScore))) return undefined
  return { score, maxScore }
}

function normalizeExamMonth(value: string) {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value)
  if (!match) return null
  const normalized = `${match[1]}-${match[2]}-01`
  const date = new Date(`${normalized}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized ? normalized : null
}

function currentDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function getStudents() {
  const { data, error } = await supabaseAdmin().from('students')
    .select('id, first_name, last_name, class_id, active, attendance_started_on').order('first_name').order('last_name')
  if (error) throw error
  return data ?? []
}

async function getAttendanceManagement(classId: string, classDate: string) {
  const { data: classes, error: classError } = await supabaseAdmin().from('classes').select('id, name').order('name')
  if (classError) throw classError

  const classList = classes ?? []
  const selectedClassId = classList.some((item) => item.id === classId) ? classId : classList[0]?.id ?? ''
  if (!selectedClassId) return { classes: classList, selected_class_id: '', students: [], present_student_ids: [] }

  const { data: students, error: studentError } = await supabaseAdmin().from('students')
    .select('id, first_name, last_name, attendance_started_on')
    .eq('class_id', selectedClassId)
    .eq('active', true)
    .order('first_name')
    .order('last_name')
  if (studentError) throw studentError

  const studentList = students ?? []
  if (!studentList.length) return { classes: classList, selected_class_id: selectedClassId, students: [], present_student_ids: [] }

  const { data: attendance, error: attendanceError } = await supabaseAdmin().from('student_attendance')
    .select('student_id')
    .eq('class_date', classDate)
    .eq('present', true)
    .in('student_id', studentList.map((student) => student.id))
  if (attendanceError) throw attendanceError

  return {
    classes: classList,
    selected_class_id: selectedClassId,
    students: studentList,
    present_student_ids: (attendance ?? []).map((row) => row.student_id),
  }
}

async function getClasses() {
  const [{ data: classes, error: classError }, { data: students, error: studentError }] = await Promise.all([
    supabaseAdmin().from('classes').select('id, name').order('name'),
    supabaseAdmin().from('students').select('class_id').eq('active', true),
  ])
  if (classError) throw classError
  if (studentError) throw studentError
  const activeCounts = (students ?? []).reduce<Record<string, number>>((counts, row) => {
    if (row.class_id) counts[row.class_id] = (counts[row.class_id] ?? 0) + 1
    return counts
  }, {})
  return (classes ?? []).map((row) => ({ ...row, active_student_count: activeCounts[row.id] ?? 0 }))
}

async function getParents() {
  const [{ data: parents, error: parentError }, { data: links, error: linkError }, { data: students, error: studentError }] = await Promise.all([
    supabaseAdmin().from('profiles').select('id, username, email').eq('role', 'parent').order('username'),
    supabaseAdmin().from('parent_student').select('parent_id, student_id'),
    supabaseAdmin().from('students').select('id, first_name, last_name, active').order('first_name'),
  ])
  if (parentError) throw parentError
  if (linkError) throw linkError
  if (studentError) throw studentError
  const authStateByParent = new Map(await Promise.all((parents ?? []).map(async (parent) => {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(parent.id)
    // A profile without an Auth user cannot sign in, so surface it as archived.
    return [parent.id, !error && authUserIsActive(data.user?.banned_until)] as const
  })))
  const studentsById = new Map((students ?? []).map((student) => [student.id, student]))
  const linksByParent = (links ?? []).reduce<Record<string, string[]>>((result, link) => {
    result[link.parent_id] = [...(result[link.parent_id] ?? []), link.student_id]
    return result
  }, {})
  return (parents ?? []).map((parent) => {
    const studentIds = linksByParent[parent.id] ?? []
    return {
      id: parent.id, username: parent.username, active: authStateByParent.get(parent.id) ?? false, student_ids: studentIds,
      students: studentIds.map((id) => studentsById.get(id)).filter(Boolean)
        .map((student) => ({ id: student!.id, name: studentName(student!), active: student!.active })),
    }
  })
}

async function getExamManagement() {
  const [{ data: students, error: studentError }, { data: classes, error: classError }, { data: results, error: resultError }] = await Promise.all([
    supabaseAdmin().from('students').select('id, first_name, last_name, class_id').eq('active', true).order('first_name').order('last_name'),
    supabaseAdmin().from('classes').select('id, name').order('name'),
    supabaseAdmin().from('exam_results').select('id, student_id, exam_date, quran_score, quran_max_score, islamic_studies_score, islamic_studies_max_score, arabic_score, arabic_max_score, created_at, updated_at').order('exam_date', { ascending: false }).order('updated_at', { ascending: false }),
  ])
  if (studentError) throw studentError
  if (classError) throw classError
  if (resultError) throw resultError
  const classNames = new Map((classes ?? []).map((item) => [item.id, item.name]))
  return {
    students: (students ?? []).map((student) => ({ ...student, class_name: classNames.get(student.class_id) ?? 'No class' })),
    results: results ?? [],
  }
}

async function replaceParentStudents(parentId: string, studentIds: string[]) {
  const uniqueIds = [...new Set(studentIds)]
  const { data: existing, error: existingError } = await supabaseAdmin().from('parent_student')
    .select('parent_id, student_id').eq('parent_id', parentId)
  if (existingError) throw existingError
  const { error: deleteError } = await supabaseAdmin().from('parent_student').delete().eq('parent_id', parentId)
  if (deleteError) throw deleteError
  if (!uniqueIds.length) return
  const { error: insertError } = await supabaseAdmin().from('parent_student')
    .insert(uniqueIds.map((student_id) => ({ parent_id: parentId, student_id })))
  if (insertError) {
    if ((existing ?? []).length) await supabaseAdmin().from('parent_student').insert(existing)
    throw insertError
  }
}

export async function GET(request: NextRequest) {
  try {
    const resource = request.nextUrl.searchParams.get('resource')
    const editorResource = resource === 'exam-management' || resource === 'attendance-management'
    const user = editorResource ? await requireExamEditor(request) : await requireAdmin(request)
    if (!user) return NextResponse.json({ error: editorResource ? 'Admin or staff access required.' : 'Admin access required.' }, { status: 403 })
    if (resource === 'students') return NextResponse.json({ students: await getStudents() })
    if (resource === 'classes') return NextResponse.json({ classes: await getClasses() })
    if (resource === 'parents') return NextResponse.json({ parents: await getParents() })
    if (resource === 'exam-management') return NextResponse.json(await getExamManagement())
    if (resource === 'attendance-management') {
      const classDate = request.nextUrl.searchParams.get('class_date') ?? ''
      if (!isSaturdayDate(classDate)) return badRequest('Choose a Saturday for the attendance register.')
      return NextResponse.json(await getAttendanceManagement(request.nextUrl.searchParams.get('class_id') ?? '', classDate))
    }
    if (resource === 'parent-form') {
      const [{ data: students, error: studentError }, classes] = await Promise.all([
        supabaseAdmin().from('students').select('id, first_name, last_name, class_id, active').order('first_name'), getClasses(),
      ])
      if (studentError) throw studentError
      return NextResponse.json({ students: students ?? [], classes })
    }
    return badRequest('Unknown management resource.')
  } catch (error) {
    console.error('Admin management GET failed', error)
    return NextResponse.json({ error: 'Could not load management data.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action as string
    const editorAction = action === 'upsert-exam-result' || action === 'save-attendance'
    const user = editorAction ? await requireExamEditor(request) : await requireAdmin(request)
    if (!user) return NextResponse.json({ error: editorAction ? 'Admin or staff access required.' : 'Admin access required.' }, { status: 403 })
    if (action === 'create-student' || action === 'update-student') {
      const input: StudentInput = body.student
      const first_name = String(input?.first_name ?? '').trim()
      const last_name = String(input?.last_name ?? '').trim() || null
      const class_id = String(input?.class_id ?? '').trim() || null
      if (!first_name) return badRequest('First name is required.')
      const studentId = String(body.student_id ?? '')
      let attendanceStartedOn: string | null = class_id ? currentDate() : null
      if (action === 'update-student') {
        const { data: existing, error: existingError } = await supabaseAdmin().from('students')
          .select('id, class_id, attendance_started_on').eq('id', studentId).maybeSingle()
        if (existingError) throw existingError
        if (!existing) return badRequest('Student not found.')
        attendanceStartedOn = class_id
          ? existing.class_id && existing.attendance_started_on ? existing.attendance_started_on : currentDate()
          : null
      }
      const payload = { first_name, last_name, class_id, attendance_started_on: attendanceStartedOn }
      const query = action === 'create-student'
        ? supabaseAdmin().from('students').insert({ ...payload, active: true })
        : supabaseAdmin().from('students').update(payload).eq('id', studentId)
      const { error } = await query
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (action === 'set-student-active') {
      const studentId = String(body.student_id)
      const active = Boolean(body.active)
      const { data: student, error: studentError } = await supabaseAdmin().from('students')
        .select('id, class_id').eq('id', studentId).maybeSingle()
      if (studentError) throw studentError
      if (!student) return badRequest('Student not found.')
      const payload = active
        ? { active: true, attendance_started_on: student.class_id ? currentDate() : null }
        : { active: false }
      const { error } = await supabaseAdmin().from('students').update(payload).eq('id', studentId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (action === 'create-class' || action === 'update-class') {
      const name = String(body.name ?? '').trim()
      if (!name) return badRequest('Class name is required.')
      const query = action === 'create-class'
        ? supabaseAdmin().from('classes').insert({ name })
        : supabaseAdmin().from('classes').update({ name }).eq('id', String(body.class_id))
      const { error } = await query
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (action === 'delete-class') {
      const classId = String(body.class_id)
      const { count, error: countError } = await supabaseAdmin().from('students').select('*', { count: 'exact', head: true })
        .eq('class_id', classId).eq('active', true)
      if (countError) throw countError
      if ((count ?? 0) > 0) return badRequest('Move or archive all active students before deleting this class.')
      const { error } = await supabaseAdmin().from('classes').delete().eq('id', classId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (action === 'create-parent') {
      const username = cleanUsername(body.username)
      const password = String(body.temporary_password ?? '')
      const studentIds = Array.isArray(body.student_ids) ? body.student_ids.map(String) : []
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return badRequest('Use 3–40 lowercase letters, numbers, dots, dashes, or underscores for the username.')
      if (password.length < 8) return badRequest('Temporary password must be at least 8 characters.')
      const { data: existing } = await supabaseAdmin().from('profiles').select('id').eq('username', username).maybeSingle()
      if (existing) return badRequest('That username is already in use.')
      const email = `${username}@parent.nasfat-manchester.internal`
      const { data: created, error: createError } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true })
      if (createError || !created.user) throw createError ?? new Error('Auth user was not created.')
      try {
        const { error: profileError } = await supabaseAdmin().from('profiles')
          .upsert({ id: created.user.id, username, email, role: 'parent' }, { onConflict: 'id' })
        if (profileError) throw profileError
        await replaceParentStudents(created.user.id, studentIds)
      } catch (error) {
        await supabaseAdmin().auth.admin.deleteUser(created.user.id)
        throw error
      }
      return NextResponse.json({ ok: true })
    }
    if (action === 'update-parent') {
      const parentId = String(body.parent_id)
      const username = cleanUsername(body.username)
      const studentIds = Array.isArray(body.student_ids) ? body.student_ids.map(String) : []
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return badRequest('Use 3–40 lowercase letters, numbers, dots, dashes, or underscores for the username.')
      const { data: conflict, error: conflictError } = await supabaseAdmin().from('profiles').select('id')
        .eq('username', username).neq('id', parentId).maybeSingle()
      if (conflictError) throw conflictError
      if (conflict) return badRequest('That username is already in use.')
      const { error: profileError } = await supabaseAdmin().from('profiles').update({ username }).eq('id', parentId).eq('role', 'parent')
      if (profileError) throw profileError
      await replaceParentStudents(parentId, studentIds)
      return NextResponse.json({ ok: true })
    }
    if (action === 'set-parent-active') {
      const parentId = String(body.parent_id)
      const active = Boolean(body.active)
      const { data: parent, error: parentError } = await supabaseAdmin().from('profiles')
        .select('id').eq('id', parentId).eq('role', 'parent').maybeSingle()
      if (parentError) throw parentError
      if (!parent) return badRequest('Parent account not found.')
      const { error: authError } = await supabaseAdmin().auth.admin.updateUserById(parentId, {
        ban_duration: active ? 'none' : parentArchiveDuration,
      })
      if (authError) throw authError
      return NextResponse.json({ ok: true })
    }
    if (action === 'save-attendance') {
      const classId = String(body.class_id ?? '')
      const classDate = String(body.class_date ?? '')
      const requestedPresentIds = [...new Set(Array.isArray(body.present_student_ids) ? body.present_student_ids.map(String) : [])]
      if (!classId || !isSaturdayDate(classDate)) return badRequest('Choose a class and a Saturday.')
      if (classDate > nextSaturdayDate()) return badRequest('Attendance cannot be recorded beyond the next Saturday.')

      const [{ data: selectedClass, error: classError }, { data: students, error: studentError }] = await Promise.all([
        supabaseAdmin().from('classes').select('id').eq('id', classId).maybeSingle(),
        supabaseAdmin().from('students').select('id, attendance_started_on').eq('class_id', classId).eq('active', true),
      ])
      if (classError) throw classError
      if (studentError) throw studentError
      if (!selectedClass) return badRequest('Class not found.')

      const studentList = students ?? []
      const activeIds = new Set(studentList.map((student) => student.id))
      if (requestedPresentIds.some((studentId) => !activeIds.has(studentId))) {
        return badRequest('The register contains a student who is not active in this class.')
      }

      const eligibleIds = studentList
        .filter((student) => student.attendance_started_on && student.attendance_started_on <= classDate)
        .map((student) => student.id)
      const eligibleIdSet = new Set(eligibleIds)
      if (requestedPresentIds.some((studentId) => !eligibleIdSet.has(studentId))) {
        return badRequest('Attendance tracking for one of the selected students starts after this class date.')
      }
      if (!eligibleIds.length) return NextResponse.json({ ok: true, present_count: 0, student_count: 0 })

      const { data: existing, error: existingError } = await supabaseAdmin().from('student_attendance')
        .select('id, student_id, class_id, class_date, present, marked_by, created_at, updated_at')
        .eq('class_date', classDate)
        .in('student_id', eligibleIds)
      if (existingError) throw existingError

      const { error: deleteError } = await supabaseAdmin().from('student_attendance')
        .delete()
        .eq('class_date', classDate)
        .in('student_id', eligibleIds)
      if (deleteError) throw deleteError

      if (requestedPresentIds.length) {
        const timestamp = new Date().toISOString()
        const { error: insertError } = await supabaseAdmin().from('student_attendance').insert(requestedPresentIds.map((studentId) => ({
          student_id: studentId,
          class_id: classId,
          class_date: classDate,
          present: true,
          marked_by: user.id,
          updated_at: timestamp,
        })))
        if (insertError) {
          if ((existing ?? []).length) {
            const { error: restoreError } = await supabaseAdmin().from('student_attendance').insert(existing)
            if (restoreError) console.error('Attendance restore failed', restoreError)
          }
          throw insertError
        }
      }

      return NextResponse.json({ ok: true, present_count: requestedPresentIds.length, student_count: eligibleIds.length })
    }
    if (action === 'upsert-exam-result') {
      const studentId = String(body.student_id ?? '')
      const rawExamMonth = String(body.exam_month ?? body.exam_date ?? '').trim()
      const examDate = normalizeExamMonth(rawExamMonth)
      const resultId = String(body.result_id ?? '').trim()
      const scores = [readScore(body.quran_score), readScore(body.islamic_studies_score), readScore(body.arabic_score)]
      if (!studentId || !examDate) return badRequest('Choose a student and exam month.')
      if (scores.some((score) => score === undefined)) return badRequest('Scores must be marks of zero or more, optionally written like 35/40.')
      if (scores.every((score) => score?.score === null)) return badRequest('Enter at least one subject score.')
      const { data: student, error: studentError } = await supabaseAdmin().from('students')
        .select('id').eq('id', studentId).eq('active', true).maybeSingle()
      if (studentError) throw studentError
      if (!student) return badRequest('Choose an active student.')
      const [quran, islamicStudies, arabic] = scores as ParsedExamScore[]
      const payload = {
        student_id: studentId,
        exam_date: examDate,
        assessment_name: null,
        quran_score: quran.score,
        quran_max_score: quran.maxScore,
        islamic_studies_score: islamicStudies.score,
        islamic_studies_max_score: islamicStudies.maxScore,
        arabic_score: arabic.score,
        arabic_max_score: arabic.maxScore,
        entered_by: user.id,
        updated_at: new Date().toISOString(),
      }

      if (resultId) {
        const { data: collision, error: collisionError } = await supabaseAdmin().from('exam_results').select('id')
          .eq('student_id', studentId).eq('exam_date', examDate).neq('id', resultId).maybeSingle()
        if (collisionError) throw collisionError
        if (collision) return badRequest('That student already has results for this exam month. Edit the existing month instead.')
        const { data: updated, error } = await supabaseAdmin().from('exam_results').update(payload)
          .eq('id', resultId).eq('student_id', studentId).select('id').maybeSingle()
        if (error) throw error
        if (!updated) return badRequest('Exam result not found.')
      } else {
        const { data: existing, error: existingError } = await supabaseAdmin().from('exam_results')
          .select('id, quran_score, quran_max_score, islamic_studies_score, islamic_studies_max_score, arabic_score, arabic_max_score')
          .eq('student_id', studentId).eq('exam_date', examDate).maybeSingle()
        if (existingError) throw existingError
        const mergedPayload = existing ? {
          ...payload,
          quran_score: quran.score ?? existing.quran_score,
          quran_max_score: quran.score === null ? existing.quran_max_score : quran.maxScore,
          islamic_studies_score: islamicStudies.score ?? existing.islamic_studies_score,
          islamic_studies_max_score: islamicStudies.score === null ? existing.islamic_studies_max_score : islamicStudies.maxScore,
          arabic_score: arabic.score ?? existing.arabic_score,
          arabic_max_score: arabic.score === null ? existing.arabic_max_score : arabic.maxScore,
        } : payload
        const { error } = existing
          ? await supabaseAdmin().from('exam_results').update(mergedPayload).eq('id', existing.id)
          : await supabaseAdmin().from('exam_results').insert(mergedPayload)
        if (error) throw error
      }
      return NextResponse.json({ ok: true })
    }
    return badRequest('Unknown management action.')
  } catch (error) {
    console.error('Admin management POST failed', error)
    return NextResponse.json({ error: 'The change could not be saved. Please try again.' }, { status: 500 })
  }
}
