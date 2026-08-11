import { supabase } from '@/lib/supabaseClient'

export async function managementRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Your session has expired. Please sign in again.')
  const response = await fetch(`/api/admin/manage${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.')
  return data as T
}

export function managementPost<T>(body: object) {
  return managementRequest<T>('', { method: 'POST', body: JSON.stringify(body) })
}
