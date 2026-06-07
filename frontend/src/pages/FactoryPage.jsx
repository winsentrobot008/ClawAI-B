import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Clock, DollarSign, FileText, CheckCircle, XCircle,
  ArrowLeft, ExternalLink, Download, Eye, Filter,
  Search, Activity, ChevronDown
} from 'lucide-react'

// ─── Inline dark-theme styles (completely independent, no shared state) ───────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0b0e14, #141820, #0b0e14)',
    color: '#e6edf3',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  },
  header: {
    padding: '2rem 2rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,.06)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    background: 'rgba(11,14,20,.8)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  container: { maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem' },
  title: {
    fontSize: '1.8rem', fontWeight: 700,
    background: 'linear-gradient(90deg,#58a6ff,#3fb950)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-flex', alignItems: 'center', gap: '.5rem',
  },
  card: {
    background: 'rgba(255,255,255,.03)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,.06)',
    borderRadius: '14px',
    padding: '1.25rem',
    transition: 'border-color .3s, box-shadow .3s',
  },
  statBox: {
    textAlign: 'center', padding: '1rem',
    background: 'rgba(255,255,255,.02)',
    borderRadius: '12px',
  },
  statValue: { fontSize: '1.5rem', fontWeight: 700, color: '#58a6ff' },
  statLabel: { fontSize: '.7rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: '.25rem' },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
    padding: '.15rem .5rem', borderRadius: '6px',
    fontSize: '.7rem', fontWeight: 600,
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.2fr 1fr 1fr 0.8fr 0.8fr 1.2fr 0.6fr',
    gap: '.5rem',
    padding: '.75rem 1rem',
    fontSize: '.7rem',
    fontWeight: 600,
    color: '#484f58',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    borderBottom: '1px solid rgba(255,255,255,.04)',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.2fr 1fr 1fr 0.8fr 0.8fr 1.2fr 0.6fr',
    gap: '.5rem',
    padding: '.75rem 1rem',
    fontSize: '.85rem',
    borderBottom: '1px solid rgba(255,255,255,.03)',
    transition: 'background .2s',
    alignItems: 'center',
  },
  input: {
    padding: '.6rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#e6edf3', fontSize: '.9rem', outline: 'none', width: '100%',
    transition: 'border-color .3s',
  },
  select: {
    padding: '.6rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#e6edf3', fontSize: '.9rem', outline: 'none', cursor: 'pointer',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '.4rem',
    padding: '.5rem 1rem', borderRadius: '8px',
    border: '1px solid rgba(88,166,255,.2)',
    fontSize: '.8rem', fontWeight: 500, cursor: 'pointer',
    color: '#58a6ff', textDecoration: 'none',
    transition: 'all .3s',
  },
  artifactBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '.25rem',
    padding: '.15rem .4rem', borderRadius: '4px',
    fontSize: '.65rem', fontWeight: 600,
    background: 'rgba(188,140,255,.15)', color: '#bc8cff',
  },
  footer: {
    textAlign: 'center', padding: '2rem', color: '#30363d', fontSize: '.8rem',
    borderTop: '1px solid rgba(255,255,255,.04)',
  },
}

// ─── Duration formatter ────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (secs == null) return '—'
  if (secs < 60) return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Date formatter ────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ─── Main Component ────────────────────────────────────────────────────────────
const FactoryPage = () => {
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // ── Fetch completions from JSONL ledgers ─────────────────────────────────
  const fetchCompletions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/factory/completions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCompletions(data.completions || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCompletions() }, [fetchCompletions])

  // ── Extract unique agents ────────────────────────────────────────────────
  const allAgents = [...new Set(completions.map(c => c.agent_signature))].sort()

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = completions.filter(c => {
    if (search && !c.task_id.toLowerCase().includes(search.toLowerCase()) &&
        !c.agent_signature.toLowerCase().includes(search.toLowerCase()) &&
        !(c.sector || '').toLowerCase().includes(search.toLowerCase()) &&
        !(c.occupation || '').toLowerCase().includes(search.toLowerCase())) return false
    if (agentFilter !== 'all' && c.agent_signature !== agentFilter) return false
    if (statusFilter === 'completed' && !c.work_submitted) return false
    if (statusFilter === 'pending' && c.work_submitted) return false
    return true
  })

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalEarned = completions.reduce((s, c) => s + (c.money_earned || 0), 0)
  const totalSubmitted = completions.filter(c => c.work_submitted).length
  const totalWithArtifacts = completions.filter(c => c.has_artifacts).length
  const totalWallClock = completions.reduce((s, c) => s + (c.wall_clock_seconds || 0), 0)

  return (
    <div style={S.page}>
      <style>{`
        @keyframes shimmerGradient {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 200% center; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .factory-row:hover { background: rgba(255,255,255,.04) !important; }
        .factory-card:hover {
          border-color: rgba(88,166,255,.12) !important;
          box-shadow: 0 0 25px rgba(88,166,255,.03) !important;
        }
        .factory-search:focus { border-color: rgba(88,166,255,.3) !important; }
        .factory-select:focus { border-color: rgba(88,166,255,.3) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 3px; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link to="/"
                style={{
                  ...S.linkBtn, borderColor: 'rgba(255,255,255,.08)', color: '#8b949e',
                }}>
                <ArrowLeft className="w-4 h-4" />
                返回仪表盘
              </Link>
              <h1 style={S.title}>
                <Activity className="w-6 h-6" style={{ color: '#3fb950' }} />
                工厂生产账本
              </h1>
            </div>
            <button onClick={fetchCompletions}
              style={{
                ...S.linkBtn, borderColor: 'rgba(63,185,80,.2)', color: '#3fb950',
                background: 'rgba(63,185,80,.05)',
              }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新数据
            </button>
          </div>
          <p style={{ color: '#8b949e', fontSize: '.85rem', marginTop: '.5rem' }}>
            基于 JSONL 账本直接读取 · 共 {completions.length} 条历史生产记录
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* ── Stats Row ──────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '.75rem', marginBottom: '1.5rem',
          }}>
          {[
            { value: completions.length, label: '历史任务总数', color: '#58a6ff' },
            { value: totalSubmitted, label: '已完成任务', color: '#3fb950' },
            { value: `$${totalEarned.toFixed(2)}`, label: '累计收益', color: '#d29922' },
            { value: totalWithArtifacts, label: '含工件任务', color: '#bc8cff' },
            { value: formatDuration(totalWallClock), label: '总耗时', color: '#f0883e' },
          ].map((s, i) => (
            <div key={i} style={S.statBox}>
              <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ ...S.card, marginBottom: '1rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}
          className="factory-card">
          <Search className="w-4 h-4" style={{ color: '#484f58', flexShrink: 0 }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索任务 ID、Agent、行业、职业..."
            style={{ ...S.input, minWidth: '200px', flex: 2 }} className="factory-search" />
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            style={{ ...S.select, minWidth: '140px', flex: 1 }} className="factory-select">
            <option value="all">🤖 所有 Agent</option>
            {allAgents.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ ...S.select, minWidth: '120px', flex: 0.5 }} className="factory-select">
            <option value="all">📋 全部状态</option>
            <option value="completed">✅ 已完成</option>
            <option value="pending">⏳ 进行中</option>
          </select>
          <span style={{ fontSize: '.75rem', color: '#484f58', whiteSpace: 'nowrap' }}>
            {filtered.length} / {completions.length} 条
          </span>
        </motion.div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={S.card} className="factory-card">
          {/* Table Header */}
          <div style={S.tableHeader}>
            <span>任务 ID</span>
            <span>Agent</span>
            <span>日期</span>
            <span>行业 / 职业</span>
            <span>收益</span>
            <span>耗时</span>
            <span>工件</span>
            <span>状态</span>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#484f58' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>⏳</div>
              正在读取 JSONL 账本...
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#f85149' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>❌</div>
              <p>加载失败: {error}</p>
              <button onClick={fetchCompletions}
                style={{ marginTop: '1rem', ...S.linkBtn, borderColor: 'rgba(248,81,73,.3)', color: '#f85149' }}>
                重试
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#484f58' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📭</div>
              <p>暂无匹配的生产记录</p>
            </div>
          )}

          {/* Table Rows */}
          {!loading && !error && filtered.map((c, i) => (
            <motion.div key={c.task_id} initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.015, 0.5) }}
              className="factory-row" style={S.tableRow}>
              {/* Task ID */}
              <span style={{ fontFamily: "'SF Mono','Consolas',monospace", fontSize: '.75rem', color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.task_id.slice(0, 12)}...
              </span>

              {/* Agent */}
              <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                  background: c.work_submitted ? '#3fb950' : '#d29922',
                  flexShrink: 0,
                }} />
                {c.agent_signature}
              </span>

              {/* Date */}
              <span style={{ color: '#8b949e', fontSize: '.8rem' }}>{formatDate(c.date)}</span>

              {/* Sector / Occupation */}
              <span style={{ fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{
                  ...S.badge, background: 'rgba(88,166,255,.1)', color: '#79c0ff',
                }}>{c.sector?.slice(0, 20) || '—'}</span>
                <span style={{ color: '#484f58', margin: '0 .2rem' }}>/</span>
                <span style={{ color: '#8b949e' }}>{c.occupation?.slice(0, 15) || '—'}</span>
              </span>

              {/* Earnings */}
              <span style={{
                fontWeight: 600,
                color: c.money_earned > 0 ? '#3fb950' : '#484f58',
              }}>
                {c.money_earned > 0 ? `$${c.money_earned.toFixed(2)}` : '—'}
              </span>

              {/* Duration */}
              <span style={{ color: '#8b949e', fontSize: '.8rem' }}>
                {formatDuration(c.wall_clock_seconds)}
              </span>

              {/* Artifacts */}
              <span>
                {c.has_artifacts ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                    {c.artifacts.slice(0, 2).map((a, j) => (
                      <div key={j} style={S.artifactBadge}>
                        <FileText className="w-3 h-3" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', whiteSpace: 'nowrap' }}>
                          {a.filename}
                        </span>
                        <a href={`/api/artifacts/file?path=${encodeURIComponent(a.path)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: '#bc8cff', display: 'inline-flex' }}
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    ))}
                    {c.artifacts.length > 2 && (
                      <span style={{ fontSize: '.65rem', color: '#484f58' }}>
                        +{c.artifacts.length - 2} 更多
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#484f58', fontSize: '.75rem' }}>—</span>
                )}
              </span>

              {/* Status */}
              <span>
                {c.work_submitted ? (
                  <span style={{ ...S.badge, background: 'rgba(63,185,80,.12)', color: '#3fb950' }}>
                    <CheckCircle className="w-3 h-3" />
                    完成
                  </span>
                ) : (
                  <span style={{ ...S.badge, background: 'rgba(210,153,34,.12)', color: '#d29922' }}>
                    <Clock className="w-3 h-3" />
                    进行中
                  </span>
                )}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div style={S.footer}>
          工厂生产账本 · 数据源: economic/task_completions.jsonl · 独立路由 /factory · 与主仪表盘状态完全解耦
        </div>
      </div>
    </div>
  )
}

export default FactoryPage