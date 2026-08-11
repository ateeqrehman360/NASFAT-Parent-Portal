import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type StudentInput = { first_name: string; last_name?: string | null; class_id: string }

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

async function requireAdmin(request: NextRequest) {
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
  return profile?.role === 'admin' ? authData.user : null
}

function badRequest(message: string) { return NextResponse.json({ error: message }, { status: 400 }) }

async function getStudents() {
  const { data, error } = await supabaseAdmin().from('students')
    .select('id, first_name, last_name, class_id, active').order('first_name').order('last_name')
  if (error) throw error
  return data ?? []
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
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  try {
    const resource = request.nextUrl.searchParams.get('resource')
    if (resource === 'students') return NextResponse.json({ students: await getStudents() })
    if (resource === 'classes') return NextResponse.json({ classes: await getClasses() })
    if (resource === 'parents') return NextResponse.json({ parents: await getParents() })
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
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  try {
    const body = await request.json()
    const action = body.action as string
    if (action === 'create-student' || action === 'update-student') {
      const input: StudentInput = body.student
      const first_name = String(input?.first_name ?? '').trim()
      const last_name = String(input?.last_name ?? '').trim() || null
      const class_id = String(input?.class_id ?? '')
      if (!first_name || !class_id) return badRequest('First name and class are required.')
      const payload = { first_name, last_name, class_id }
      const query = action === 'create-student'
        ? supabaseAdmin().from('students').insert({ ...payload, active: true })
        : supabaseAdmin().from('students').update(payload).eq('id', String(body.student_id))
      const { error } = await query
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (action === 'set-student-active') {
      const { error } = await supabaseAdmin().from('students').update({ active: Boolean(body.active) }).eq('id', String(body.student_id))
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
    return badRequest('Unknown management action.')
  } catch (error) {
    console.error('Admin management POST failed', error)
    return NextResponse.json({ error: 'The change could not be saved. Please try again.' }, { status: 500 })
  }
}
