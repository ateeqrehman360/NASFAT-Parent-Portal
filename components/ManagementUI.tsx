'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export const ui: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #EAF4FB 0%, #F5F7FA 40%)', color: '#111827', padding: 14 },
  content: { width: '100%', maxWidth: 780, margin: '0 auto', paddingBottom: 42 },
  header: { background: 'rgba(255,255,255,.92)', border: '1px solid rgba(203,213,225,.88)', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', boxShadow: '0 8px 24px rgba(31,58,95,.07)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  headerCopy: { minWidth: 0, flex: '1 1 210px' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  title: { color: '#1F3A5F', fontSize: 21, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-.01em' },
  subtitle: { marginTop: 5, color: '#6B7280', fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
  logo: { width: 42, height: 'auto', flexShrink: 0 },
  card: { marginTop: 16, padding: 16, background: 'rgba(255,255,255,.94)', border: '1px solid rgba(226,232,240,.95)', borderRadius: 20, boxShadow: '0 10px 28px rgba(31,58,95,.09)', color: '#111827', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  cardTitle: { color: '#1F3A5F', fontSize: 17, fontWeight: 900, lineHeight: 1.25 },
  hint: { marginTop: 5, color: '#6B7280', fontSize: 13, lineHeight: 1.45 },
  input: { width: '100%', minHeight: 48, boxSizing: 'border-box', borderRadius: 14, border: '1px solid #CBD5E1', background: '#fff', color: '#111827', padding: '10px 13px', fontSize: 16, marginTop: 7, boxShadow: 'inset 0 1px 1px rgba(15,23,42,.02)' },
  label: { display: 'block', marginTop: 14, color: '#1F3A5F', fontWeight: 800, fontSize: 14, lineHeight: 1.3 },
  button: { minHeight: 46, borderRadius: 14, border: '1px solid #CBD5E1', background: '#fff', color: '#1F3A5F', padding: '10px 14px', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,.04)' },
  primary: { minHeight: 48, borderRadius: 14, border: '1px solid #152C4A', background: '#1F3A5F', color: '#fff', padding: '10px 17px', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 5px 12px rgba(31,58,95,.22)' },
  danger: { minHeight: 46, borderRadius: 14, border: '1px solid #FECACA', background: '#FFF1F2', color: '#B91C1C', padding: '10px 14px', fontSize: 14, fontWeight: 900, cursor: 'pointer' },
  row: { marginTop: 10, padding: 14, borderRadius: 16, border: '1px solid #D7DEE8', background: '#fff', color: '#1F3A5F', boxShadow: '0 2px 5px rgba(15,23,42,.025)' },
  rowHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowTitle: { fontWeight: 900, color: '#1F3A5F', fontSize: 15, lineHeight: 1.3 },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 13 },
  status: { marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid #CFE6F6', background: '#EAF4FB', color: '#1F3A5F', fontWeight: 700, fontSize: 14, lineHeight: 1.4 },
  error: { marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700, fontSize: 14, lineHeight: 1.4 },
  search: { marginTop: 14, width: '100%', minHeight: 48, boxSizing: 'border-box', borderRadius: 14, border: '1px solid #CBD5E1', background: '#fff', color: '#111827', padding: '10px 13px', fontSize: 16 },
  countPill: { display: 'inline-flex', alignItems: 'center', minHeight: 28, borderRadius: 999, padding: '4px 10px', background: '#EAF4FB', border: '1px solid #CFE6F6', color: '#1F3A5F', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' },
  fieldHeader: { marginTop: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  selectionSummary: { marginTop: 10, padding: '10px 12px', borderRadius: 14, background: '#F5FAFE', border: '1px solid #D8EAF7', color: '#1F3A5F', fontSize: 13, lineHeight: 1.45 },
  pickerToolbar: { marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  checklist: { marginTop: 10, display: 'grid', gap: 8 },
  checkboxRow: { minHeight: 50, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 14, border: '1px solid #D7DEE8', background: '#fff', color: '#1F3A5F', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' },
  checkboxRowSelected: { background: '#EAF4FB', border: '1px solid #9ED1EC' },
  checkboxRowArchived: { background: '#F8FAFC', border: '1px dashed #CBD5E1', color: '#475569' },
  checkbox: { width: 21, height: 21, flexShrink: 0, accentColor: '#1F3A5F' },
  checkboxName: { display: 'block', fontWeight: 800, lineHeight: 1.3 },
  checkboxMeta: { display: 'block', marginTop: 2, color: '#64748B', fontSize: 12, lineHeight: 1.25 },
}

export function ManagementPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const router = useRouter()
  return <main style={ui.page}><div style={ui.content}>
    <header style={ui.header}><div style={ui.headerCopy}><div style={ui.title}>{title}</div><div style={ui.subtitle}>{subtitle}</div></div><div style={ui.headerActions}><button type="button" aria-label="Back to the admin dashboard" onClick={() => router.push('/admin')} style={ui.button}>← Admin</button><img src="/nasfat-logo.png" alt="NASFAT Manchester" style={ui.logo} /></div></header>
    {children}
  </div></main>
}
