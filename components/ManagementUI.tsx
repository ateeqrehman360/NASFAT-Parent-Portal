'use client'

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export const ui: Record<string, CSSProperties> = {
  page: { minHeight: '100dvh', background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)', color: '#1D2939', padding: 'clamp(12px, 3vw, 24px)' },
  content: { width: '100%', maxWidth: 840, margin: '0 auto', paddingBottom: 'max(42px, env(safe-area-inset-bottom))' },
  header: { background: 'rgba(255,255,255,.98)', border: '1px solid rgba(186,203,218,.82)', borderRadius: 20, padding: 'clamp(15px, 3vw, 20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', boxShadow: '0 7px 20px rgba(31,58,95,.06)' },
  headerCopy: { minWidth: 0, flex: '1 1 210px' },
  headerActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' },
  eyebrow: { marginBottom: 6, color: '#4E83A5', fontSize: 11, fontWeight: 800, lineHeight: 1.2 },
  title: { color: '#1F3A5F', fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.03em' },
  subtitle: { marginTop: 6, color: '#526277', fontSize: 14, fontWeight: 500, lineHeight: 1.5, maxWidth: '62ch' },
  logo: { width: 46, height: 'auto', flexShrink: 0 },
  card: { marginTop: 18, padding: 'clamp(15px, 3vw, 20px)', background: 'rgba(255,255,255,.98)', border: '1px solid rgba(186,203,218,.72)', borderRadius: 20, boxShadow: '0 7px 20px rgba(31,58,95,.055)', color: '#1D2939' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  cardTitle: { color: '#1F3A5F', fontSize: 18, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-.015em' },
  hint: { marginTop: 5, color: '#526277', fontSize: 13, lineHeight: 1.5, fontWeight: 500 },
  input: { width: '100%', minHeight: 50, boxSizing: 'border-box', borderRadius: 12, border: '1px solid #B9C8D7', background: '#FFFFFF', color: '#1D2939', padding: '11px 13px', fontSize: 16, marginTop: 7, boxShadow: 'inset 0 1px 1px rgba(15,23,42,.025)' },
  label: { display: 'block', marginTop: 14, color: '#1F3A5F', fontWeight: 700, fontSize: 14, lineHeight: 1.35 },
  button: { minHeight: 46, borderRadius: 12, border: '1px solid #B9C8D7', background: '#FFFFFF', color: '#1F3A5F', padding: '10px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
  primary: { minHeight: 48, borderRadius: 12, border: '1px solid #152C4A', background: '#1F3A5F', color: '#FFFFFF', padding: '10px 17px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 5px 12px rgba(31,58,95,.16)' },
  danger: { minHeight: 46, borderRadius: 12, border: '1px solid #FECACA', background: '#FFF6F7', color: '#B42318', padding: '10px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
  row: { marginTop: 8, padding: 14, borderRadius: 14, border: '1px solid #D6E0EA', background: '#FFFFFF', color: '#1F3A5F' },
  rowHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowTitle: { fontWeight: 800, color: '#1F3A5F', fontSize: 15, lineHeight: 1.35 },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 13 },
  status: { marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid #CFE6F6', background: '#F0F8FD', color: '#1F3A5F', fontWeight: 600, fontSize: 14, lineHeight: 1.45 },
  error: { marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B42318', fontWeight: 600, fontSize: 14, lineHeight: 1.45 },
  search: { marginTop: 14, width: '100%', minHeight: 48, boxSizing: 'border-box', borderRadius: 12, border: '1px solid #B9C8D7', background: '#FFFFFF', color: '#1D2939', padding: '10px 13px', fontSize: 16 },
  countPill: { display: 'inline-flex', alignItems: 'center', minHeight: 28, borderRadius: 999, padding: '4px 10px', background: '#EEF7FC', border: '1px solid #CFE6F6', color: '#1F3A5F', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' },
  fieldHeader: { marginTop: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  selectionSummary: { marginTop: 10, padding: '10px 12px', borderRadius: 12, background: '#F5FAFE', border: '1px solid #D8EAF7', color: '#1F3A5F', fontSize: 13, lineHeight: 1.45 },
  pickerToolbar: { marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  checklist: { marginTop: 10, display: 'grid', gap: 8 },
  checkboxRow: { minHeight: 50, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: '1px solid #D6E0EA', background: '#FFFFFF', color: '#1F3A5F', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' },
  checkboxRowSelected: { background: '#EAF4FB', border: '1px solid #9ED1EC' },
  checkboxRowArchived: { background: '#F8FAFC', border: '1px dashed #CBD5E1', color: '#475569' },
  checkbox: { width: 21, height: 21, flexShrink: 0, accentColor: '#1F3A5F' },
  checkboxName: { display: 'block', fontWeight: 800, lineHeight: 1.3 },
  checkboxMeta: { display: 'block', marginTop: 2, color: '#64748B', fontSize: 12, lineHeight: 1.25 },
}

export function ManagementPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const router = useRouter()
  return <main className="nasfat-app" style={ui.page}><div style={ui.content}>
    <header className="nasfat-surface nasfat-enter" style={ui.header}><div style={ui.headerCopy}><h1 data-heading="true" style={{ ...ui.title, margin: 0 }}>{title}</h1><div data-body="true" style={ui.subtitle}>{subtitle}</div></div><div style={ui.headerActions}><button className="nasfat-button" type="button" aria-label="Back to the admin dashboard" onClick={() => router.push('/admin')} style={ui.button}>← Admin</button><Image className="nasfat-logo" src="/nasfat-logo.png" alt="NASFAT Manchester" width={46} height={46} priority style={ui.logo} /></div></header>
    {children}
  </div></main>
}
