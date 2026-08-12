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
  badge: string
  title: string
  description: string
  onClick: () => void
  style: Record<string, CSSProperties>
}

function ToolLink({ badge, title, description, onClick, style }: ToolLinkProps) {
  return <button className="nasfat-button nasfat-tile nasfat-stagger" type="button" onClick={onClick} style={style.tile}>
    <span style={style.tileLead}>
      <span aria-hidden="true" style={style.toolBadge}>{badge}</span>
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
        <div style={S.eyebrow}>NASFAT Manchester</div>
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
          <div style={S.sectionKicker}>Points</div>
          <h2 id="staff-points-heading" style={S.cardTitle}>Choose a class</h2>
          <div data-body="true" style={S.hint}>Open a group to log behaviour points and add teacher notes.</div>
        </div>
        <span style={S.activePill}>Start here</span>
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
      <div style={S.sectionKicker}>More tools</div>
      <h2 id="staff-tools-heading" style={S.cardTitle}>Switch task</h2>
      <div data-body="true" style={S.hint}>When points are done, update the weekly register or student progress.</div>
      <div style={S.grid}>
        <ToolLink badge="AT" title="Attendance" description="Saturday class register" onClick={() => router.push('/admin/attendance')} style={S} />
        <ToolLink badge="EX" title="Exam results" description="Enter and update scores" onClick={() => router.push('/admin/exams')} style={S} />
      </div>
    </nav>
  </div></main>
}

const styles = (isMobile: boolean): Record<string, CSSProperties> => ({
  page: { minHeight: '100dvh', background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)', color: '#111827' },
  content: { width: '100%', maxWidth: 820, boxSizing: 'border-box', margin: '0 auto', padding: isMobile ? '12px 12px max(42px, env(safe-area-inset-bottom))' : '24px 24px 48px' },
  header: { padding: isMobile ? 15 : 20, borderRadius: isMobile ? 22 : 26, border: '1px solid rgba(203,213,225,.76)', background: 'rgba(255,255,255,.92)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: '0 14px 38px rgba(31,58,95,.10)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' },
  headerCopy: { minWidth: 0, flex: 1 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  eyebrow: { marginBottom: 6, color: '#4E83A5', fontSize: 10, fontWeight: 900, lineHeight: 1, letterSpacing: '.1em', textTransform: 'uppercase' },
  title: { margin: 0, color: '#1F3A5F', fontSize: isMobile ? 21 : 26, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-.025em' },
  subtitle: { marginTop: 6, color: '#6B7280', fontSize: 13, fontWeight: 700, lineHeight: 1.4, maxWidth: 440 },
  logo: { width: isMobile ? 38 : 44, height: 'auto', flexShrink: 0 },
  button: { minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1px solid #D1D5DB', background: '#fff', color: '#1F3A5F', fontSize: 14, fontWeight: 900 },
  card: { marginTop: 16, padding: isMobile ? 16 : 20, borderRadius: isMobile ? 22 : 26, border: '1px solid rgba(203,213,225,.72)', background: 'rgba(255,255,255,.94)', boxShadow: '0 14px 38px rgba(31,58,95,.10)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' },
  toolsCard: { background: 'linear-gradient(145deg, rgba(234,244,251,.94), rgba(255,255,255,.94))', border: '1px solid rgba(207,230,246,.95)' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionKicker: { marginBottom: 6, color: '#4E83A5', fontSize: 10, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' },
  cardTitle: { margin: 0, color: '#1F3A5F', fontSize: 18, fontWeight: 900, lineHeight: 1.2 },
  hint: { marginTop: 5, color: '#6B7280', fontSize: 13, fontWeight: 700, lineHeight: 1.45 },
  activePill: { flexShrink: 0, minHeight: 28, display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, border: '1px solid #CFE6F6', background: '#EAF4FB', color: '#1F3A5F', fontSize: 12, fontWeight: 900 },
  grid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 11, marginTop: 14 },
  tile: { width: '100%', minHeight: 70, padding: '12px 13px', borderRadius: 16, border: '1px solid rgba(203,213,225,.9)', background: '#fff', color: '#111827', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 3px 10px rgba(31,58,95,.045)' },
  tileLead: { minWidth: 0, display: 'flex', alignItems: 'center', gap: 11 },
  classBadge: { width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, border: '1px solid #CFE6F6', background: '#EAF4FB', color: '#1F3A5F', fontSize: 11, fontWeight: 900, fontVariantNumeric: 'tabular-nums' },
  toolBadge: { width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, background: '#1F3A5F', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '.03em', boxShadow: '0 6px 13px rgba(31,58,95,.2)' },
  tileTitle: { display: 'block', color: '#1F3A5F', fontSize: 15, fontWeight: 900, lineHeight: 1.2 },
  tileDescription: { display: 'block', marginTop: 4, color: '#64748B', fontSize: 11, fontWeight: 700, lineHeight: 1.2 },
  arrow: { color: '#4DA3D9', fontSize: 18, fontWeight: 900 },
  empty: { marginTop: 14, padding: 14, borderRadius: 15, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 700, lineHeight: 1.45 },
  error: { marginTop: 14, padding: 14, borderRadius: 16, border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 700 },
})
