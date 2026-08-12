'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type ClassRow = {
  id: string
  name: string
}

type ToolLinkProps = {
  title: string
  description: string
  onClick: () => void
  style: Record<string, CSSProperties>
}

function ToolLink({ title, description, onClick, style }: ToolLinkProps) {
  return <button className="nasfat-button nasfat-tile nasfat-stagger" type="button" onClick={onClick} style={style.tile}>
    <span style={style.tileLead}>
      <span>
        <span style={style.tileTitle}>{title}</span>
        <span style={style.tileDescription}>{description}</span>
      </span>
    </span>
    <span aria-hidden="true" style={style.arrow}>→</span>
  </button>
}

export default function StaffPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!active) return
      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!active) return
      if (profileError) {
        setError('Could not load your staff account. Please try again.')
        setLoading(false)
        return
      }
      if (profile?.role === 'admin') {
        router.replace('/admin')
        return
      }
      if (profile?.role === 'parent') {
        router.replace('/parent')
        return
      }
      if (profile?.role !== 'staff') {
        router.replace('/login')
        return
      }

      const { data, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (!active) return
      if (classError) setError('Could not load classes. Please try again.')
      else setClasses(data ?? [])
      setLoading(false)
    }

    void load()
    return () => { active = false }
  }, [router])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const S = styles(isMobile)

  return <main className="nasfat-app" style={S.page}><div style={S.content}>
    <header className="nasfat-surface nasfat-enter" style={S.header}>
      <div style={S.headerCopy}>
        <h1 data-heading="true" style={S.title}>Staff dashboard</h1>
        <div data-body="true" style={S.subtitle}>Start with today’s points, then move to attendance or exam results.</div>
      </div>
      <div style={S.headerActions}>
        <Image className="nasfat-logo" src="/nasfat-logo.png" alt="NASFAT Manchester" width={44} height={44} priority style={S.logo} />
        <button className="nasfat-button" type="button" onClick={signOut} style={S.button}>Log out</button>
      </div>
    </header>

    {error && <div className="nasfat-status" role="alert" style={S.error}>{error}</div>}

    <section className="nasfat-surface nasfat-enter" style={S.card} aria-labelledby="staff-points-heading" aria-busy={loading}>
      <div style={S.cardHeader}>
        <div>
          <h2 id="staff-points-heading" style={S.cardTitle}>Points by class</h2>
          <div data-body="true" style={S.hint}>Open a group to log behaviour points and add teacher notes.</div>
        </div>
      </div>

      {loading ? <div style={S.grid} aria-label="Loading classes">
        {[0, 1, 2, 3].map((item) => <div className="nasfat-skeleton" key={item} style={{ height: 70 }}>Loading class</div>)}
      </div> : classes.length === 0 ? <div style={S.empty}>No classes are available yet. Ask an admin to create a class.</div> : <div style={S.grid}>
        {classes.map((classRow, index) => <button
          className="nasfat-button nasfat-tile nasfat-stagger"
          key={classRow.id}
          type="button"
          onClick={() => router.push(`/admin/classes/${classRow.id}`)}
          style={S.tile}
          aria-label={`Open ${classRow.name} points`}
        >
          <span style={S.tileLead}>
            <span aria-hidden="true" style={S.classBadge}>{String(index + 1).padStart(2, '0')}</span>
            <span><span style={S.tileTitle}>{classRow.name}</span><span style={S.tileDescription}>Log today’s points</span></span>
          </span>
          <span aria-hidden="true" style={S.arrow}>→</span>
        </button>)}
      </div>}
    </section>

    <nav className="nasfat-surface nasfat-enter" style={{ ...S.card, ...S.toolsCard }} aria-labelledby="staff-tools-heading">
      <h2 id="staff-tools-heading" style={S.cardTitle}>Attendance and results</h2>
      <div data-body="true" style={S.hint}>When points are done, update the weekly register or student progress.</div>
      <div style={S.grid}>
        <ToolLink title="Attendance" description="Saturday class register" onClick={() => router.push('/admin/attendance')} style={S} />
        <ToolLink title="Exam results" description="Enter and update scores" onClick={() => router.push('/admin/exams')} style={S} />
      </div>
    </nav>
  </div></main>
}

const styles = (isMobile: boolean): Record<string, CSSProperties> => ({
  page: { minHeight: '100dvh', background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)', color: '#1D2939' },
  content: { width: '100%', maxWidth: 820, boxSizing: 'border-box', margin: '0 auto', padding: isMobile ? '12px 12px max(42px, env(safe-area-inset-bottom))' : '24px 24px 48px' },
  header: { padding: isMobile ? 15 : 20, borderRadius: 20, border: '1px solid rgba(186,203,218,.82)', background: 'rgba(255,255,255,.98)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: '0 7px 20px rgba(31,58,95,.06)' },
  headerCopy: { minWidth: 0, flex: 1 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  title: { margin: 0, color: '#1F3A5F', fontSize: isMobile ? 21 : 26, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.025em' },
  subtitle: { marginTop: 6, color: '#526277', fontSize: 13, fontWeight: 500, lineHeight: 1.45, maxWidth: 440 },
  logo: { width: isMobile ? 38 : 44, height: 'auto', flexShrink: 0 },
  button: { minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1px solid #B9C8D7', background: '#fff', color: '#1F3A5F', fontSize: 14, fontWeight: 800 },
  card: { marginTop: 16, padding: isMobile ? 16 : 20, borderRadius: 20, border: '1px solid rgba(186,203,218,.72)', background: 'rgba(255,255,255,.98)', boxShadow: '0 7px 20px rgba(31,58,95,.055)' },
  toolsCard: { background: 'rgba(255,255,255,.98)', border: '1px solid rgba(186,203,218,.72)' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitle: { margin: 0, color: '#1F3A5F', fontSize: 18, fontWeight: 800, lineHeight: 1.2 },
  hint: { marginTop: 5, color: '#526277', fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 11, marginTop: 14 },
  tile: { width: '100%', minHeight: 70, padding: '12px 13px', borderRadius: 14, border: '1px solid #D6E0EA', background: '#fff', color: '#1D2939', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tileLead: { minWidth: 0, display: 'flex', alignItems: 'center', gap: 11 },
  classBadge: { width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, border: '1px solid #CFE6F6', background: '#EEF7FC', color: '#1F3A5F', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  tileTitle: { display: 'block', color: '#1F3A5F', fontSize: 15, fontWeight: 800, lineHeight: 1.2 },
  tileDescription: { display: 'block', marginTop: 4, color: '#526277', fontSize: 12, fontWeight: 500, lineHeight: 1.35 },
  arrow: { color: '#365F84', fontSize: 18, fontWeight: 800 },
  empty: { marginTop: 14, padding: 14, borderRadius: 12, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#526277', fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
  error: { marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
})
