import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Clock, DollarSign, FileText, CheckCircle, XCircle,
  ArrowLeft, ExternalLink, Download, Eye, Filter,
  Search, Activity, ChevronDown, Play, AlertCircle,
  Trash2, Globe, FolderOpen, Shuffle, Terminal, Cpu
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
    padding: '1.5rem 2rem 1rem',
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
  liveStream: {
    marginTop: '1rem', padding: '1rem', borderRadius: '10px',
    background: 'rgba(0,0,0,.3)', minHeight: '200px', maxHeight: '400px',
    overflowY: 'auto', fontSize: '.85rem', lineHeight: '1.6',
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
  },
  btnPrimary: {
    padding: '.75rem 1.5rem', borderRadius: '10px', border: 'none',
    fontSize: '.95rem', fontWeight: 600, cursor: 'pointer',
    background: 'linear-gradient(135deg,#238636,#3fb950)', color: '#fff',
    transition: 'all .3s', display: 'inline-flex', alignItems: 'center', gap: '.5rem',
  },
  btnSmall: {
    padding: '.4rem .75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,.08)',
    fontSize: '.8rem', fontWeight: 500, cursor: 'pointer',
    background: 'rgba(255,255,255,.06)', color: '#8b949e',
    transition: 'all .3s',
  },
  cardTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '.5rem' },
  artifactCard: {
    background: 'rgba(255,255,255,.03)', borderRadius: '12px', padding: '1rem',
    border: '1px solid rgba(255,255,255,.05)', transition: 'all .3s', cursor: 'pointer',
  },
}

// ─── Tag color map ──────────────────────────────────────────────────────────────
const TAG_STYLES = {
  info:    { background: 'rgba(88,166,255,.15)', color: '#79c0ff' },
  submit:  { background: 'rgba(63,185,80,.15)', color: '#3fb950' },
  complete:{ background: 'rgba(63,185,80,.25)', color: '#7ee787' },
  error:   { background: 'rgba(248,81,73,.15)', color: '#f85149' },
  code:    { background: 'rgba(88,166,255,.15)', color: '#58a6ff' },
  artifact:{ background: 'rgba(188,140,255,.15)', color: '#bc8cff' },
  dispatch:{ background: 'rgba(210,153,34,.2)', color: '#e3b341' },
  balance: { background: 'rgba(255,123,114,.15)', color: '#ff7b72' },
}

const ARTIFACT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: '.pdf', label: 'PDF' },
  { key: '.docx', label: 'DOCX' },
  { key: '.xlsx', label: 'XLSX' },
  { key: '.pptx', label: 'PPTX' },
  { key: '.html', label: 'HTML' },
]

const EXT_ICON = {
  '.pdf': '📄', '.docx': '📝', '.xlsx': '📊', '.pptx': '📽️',
  '.html': '🌐', '.htm': '🌐', '.json': '📋', '.txt': '📃',
  '.csv': '📑', '.md': '📘', '.py': '🐍', '.js': '🟨', '.ts': '🔷',
}

// ─── Utils ──────────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (secs == null) return '—'
  if (secs < 60) return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatTime(d) { return d.toLocaleTimeString() }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML }

function getTagStyle(tag) { return TAG_STYLES[tag] || TAG_STYLES.info }
const Tag = ({ type, children }) => {
  const ts = getTagStyle(type)
  return <span style={{ display: 'inline-block', padding: '.1rem .4rem', borderRadius: '4px', fontSize: '.7rem', fontWeight: 600, marginRight: '.4rem', textTransform: 'uppercase', ...ts }}>{children}</span>
}

// ─── Main Component ──────────────────────────────────────────────────────────────
const FactoryPage = () => {
  // ── Console state ────────────────────────────────────────────────────────
  const [taskInput, setTaskInput] = useState('')
  const [modelRoute, setModelRoute] = useState('')
  const [logs, setLogs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const streamRef = useRef(null)
  const wsRef = useRef(null)

  // ── Ledger state ─────────────────────────────────────────────────────────
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // ── Artifact console state ───────────────────────────────────────────────
  const [artifacts, setArtifacts] = useState([])
  const [artLoading, setArtLoading] = useState(true)
  const [artFilter, setArtFilter] = useState('all')

  // ── Agents console state ─────────────────────────────────────────────────
  const [agents, setAgents] = useState([])
  const [agentConsoleFilter, setAgentConsoleFilter] = useState('all')

  // ── Stats ────────────────────────────────────────────────────────────────
  const [statAgents, setStatAgents] = useState(0)
  const [statArtifacts, setStatArtifacts] = useState(0)

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCTION CONSOLE — WebSocket, task submit, live stream, board, artifacts
  // ══════════════════════════════════════════════════════════════════════════

  const addLog = useCallback((tag, msg, code) => {
    const entry = { id: Date.now() + Math.random(), tag, msg, code, time: new Date() }
    setLogs(prev => {
      const next = [...prev, entry]
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  // WebSocket
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${proto}//${window.location.host}/ws`
    let ws
    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        setWsConnected(true)
        addLog('submit', '✅ WebSocket 已连接到 AI 工厂实时流')
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          handleWsMessage(msg)
        } catch { /* ignore non-JSON */ }
      }
      ws.onclose = () => {
        setWsConnected(false)
        addLog('info', '🔌 WebSocket 已断开，3秒后重连...')
      }
      ws.onerror = () => addLog('error', 'WebSocket 连接错误')
      wsRef.current = ws
    } catch (e) {
      addLog('error', `WebSocket 初始化失败: ${e.message}`)
    }
    return () => { if (ws) { ws.close(); wsRef.current = null } }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleWsMessage = (msg) => {
    const t = msg.type || 'unknown'
    switch (t) {
      case 'connected':
        addLog('submit', `✅ 已连接 · ${msg.message || ''}`)
        break
      case 'heartbeat': case 'pong': break
      case 'task_dispatched':
        addLog('dispatch', `📤 任务已分发 → ${msg.assigned_model || '自动路由'} · ID: ${(msg.task_id || '').slice(-8)}`)
        break
      case 'model_selected':
        addLog('info', `🤖 董事会路由: ${msg.model} · ${msg.reason || ''}`)
        break
      case 'task_queued':
        addLog('info', `📋 任务 [${(msg.task_id || '').slice(-8)}] 已进入生产队列`)
        break
      case 'task_started':
        addLog('submit', `🚀 任务 [${(msg.task_id || '').slice(-8)}] 开始执行 · Agent: ${msg.agent || 'ECC'}`)
        break
      case 'agent_thinking':
        if (msg.thought || msg.message) addLog('code', (msg.thought || msg.message).slice(0, 300))
        break
      case 'code_generated':
        addLog('code', `💻 生成代码 (${msg.language || 'python'}):`, (msg.code || '').slice(0, 300))
        break
      case 'artifact_created':
        addLog('artifact', `📄 创建文件: ${msg.file_path || msg.filename || ''}`)
        fetchArtifactsData()
        break
      case 'work_submitted':
        addLog('submit', `✅ 工作已提交! 估值: $${(msg.estimated_value || 0).toFixed(2)}`)
        break
      case 'task_completed':
        addLog('complete', `🎉 任务完成! ${msg.message || ''}`)
        fetchArtifactsData()
        fetchAgentsData()
        break
      case 'task_error':
        addLog('error', `❌ 任务错误: ${(msg.error || '').slice(0, 300)}`)
        break
      case 'balance_update':
        if (msg.data && msg.data.revenue !== undefined) {
          addLog('balance', `💰 累计收益更新: $${msg.data.revenue.toFixed(2)}`)
        }
        break
      case 'board_update':
        fetchAgentsData()
        break
      default:
        addLog('info', `${t}: ${JSON.stringify(msg).slice(0, 200)}`)
    }
  }

  const fetchAgentsData = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      const list = data.agents || []
      setAgents(list)
      setStatAgents(list.length)
    } catch { /* ignore */ }
  }, [])

  const fetchArtifactsData = useCallback(async () => {
    try {
      setArtLoading(true)
      const res = await fetch('/api/artifacts/random?count=30')
      const data = await res.json()
      const list = data.artifacts || []
      setArtifacts(list)
      setStatArtifacts(list.length)
    } catch { /* ignore */ } finally { setArtLoading(false) }
  }, [])

  const handleSubmitTask = async () => {
    const goal = taskInput.trim()
    if (!goal) { addLog('error', '⚠️ 请输入任务描述'); return }
    setSubmitting(true)
    addLog('info', `🏭 正在提交生产任务: ${goal.slice(0, 100)}...`)
    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_description: goal,
          agent_model: modelRoute || undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      addLog('submit', `✅ 任务已创建! ID: ${result.task_id || '—'}`)
      setTaskInput('')
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'task_submitted', task_id: result.task_id, goal }))
        }
      } catch (_) { /* best-effort notify */ }
    } catch (e) {
      addLog('error', `❌ 提交失败: ${e.message}`)
    } finally { setSubmitting(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitTask() }
  }

  const clearLogs = () => setLogs([])

  const filteredConsoleAgents = agentConsoleFilter === 'all'
    ? agents
    : agents.filter(a => (a.status || 'idle').toLowerCase() === agentConsoleFilter)

  const filteredArtifacts = artFilter === 'all'
    ? artifacts
    : artifacts.filter(a => a.extension === artFilter)

  // ══════════════════════════════════════════════════════════════════════════
  // JSONL LEDGER — fetch completions
  // ══════════════════════════════════════════════════════════════════════════

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

  // ── Initial data load ───────────────────────────────────────────────────
  useEffect(() => { fetchCompletions() }, [fetchCompletions])
  useEffect(() => { fetchAgentsData(); fetchArtifactsData() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ai = setInterval(fetchAgentsData, 10000)
    const ai2 = setInterval(fetchArtifactsData, 15000)
    return () => { clearInterval(ai); clearInterval(ai2) }
  }, [fetchAgentsData, fetchArtifactsData])

  // ── Extract unique agents from ledger ──────────────────────────────────
  const allLedgerAgents = [...new Set(completions.map(c => c.agent_signature))].sort()

  // ── Filtered ledger ────────────────────────────────────────────────────
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

  // ── Ledger stats ──────────────────────────────────────────────────────
  const ledgerTotal = completions.length
  const totalSubmitted = completions.filter(c => c.work_submitted).length
  const totalEarned = completions.reduce((s, c) => s + (c.money_earned || 0), 0)
  const totalWithArtifacts = completions.filter(c => c.has_artifacts).length
  const totalWallClock = completions.reduce((s, c) => s + (c.wall_clock_seconds || 0), 0)

  const getArtifactFileUrl = (path) => `/api/artifacts/file?path=${encodeURIComponent(path)}`

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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .factory-row:hover { background: rgba(255,255,255,.04) !important; }
        .factory-card:hover {
          border-color: rgba(88,166,255,.12) !important;
          box-shadow: 0 0 25px rgba(88,166,255,.03) !important;
        }
        .factory-search:focus { border-color: rgba(88,166,255,.3) !important; }
        .factory-select:focus { border-color: rgba(88,166,255,.3) !important; }
        .factory-entry {
          padding: 0.3rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.02);
          animation: fadeIn 0.3s ease;
        }
        .factory-stream::-webkit-scrollbar { width: 6px; }
        .factory-stream::-webkit-scrollbar-track { background: transparent; }
        .factory-stream::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 3px; }
        .factory-board-card:hover {
          background: rgba(255,255,255,.06) !important;
          transform: translateY(-2px);
        }
        .factory-artifact-card:hover {
          border-color: rgba(188,140,255,.2) !important;
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link to="/"
                style={{ ...S.linkBtn, borderColor: 'rgba(255,255,255,.08)', color: '#8b949e' }}>
                <ArrowLeft className="w-4 h-4" />
                返回仪表盘
              </Link>
              <h1 style={S.title}>
                <Activity className="w-6 h-6" style={{ color: '#3fb950' }} />
                AI 工厂
              </h1>
            </div>
          </div>
          <p style={{ color: '#8b949e', fontSize: '.85rem', marginTop: '.5rem' }}>
            生产控制台 + JSONL 账本 · 全屏独立路由 · 与主仪表盘完全解耦
          </p>
        </div>
      </div>

      <div style={S.container}>
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: PRODUCTION CONSOLE                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        {/* ── Stats Row ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
          {[
            { value: statAgents, label: 'AI 董事会', color: '#58a6ff' },
            { value: statArtifacts, label: '实时工件', color: '#bc8cff' },
            { value: ledgerTotal, label: '历史任务', color: '#3fb950' },
            { value: `$${totalEarned.toFixed(2)}`, label: '累计收益', color: '#d29922' },
            { value: formatDuration(totalWallClock), label: '总耗时', color: '#f0883e' },
            { value: wsConnected ? '在线' : '离线', label: 'WebSocket', color: wsConnected ? '#3fb950' : '#f85149' },
          ].map((s, i) => (
            <div key={i} style={S.statBox}>
              <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Task Submission Card ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={S.card} className="factory-card">
          <h2 style={S.cardTitle}><span>🎯</span> 提交生产任务</h2>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <input type="text" value={taskInput} onChange={e => setTaskInput(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="输入任务描述，例如：生成一份市场分析报告..."
              style={{ ...S.input, minWidth: '250px', flex: 2 }} className="factory-search" />
            <select value={modelRoute} onChange={e => setModelRoute(e.target.value)}
              style={{ ...S.select, minWidth: '180px', flex: 1 }} className="factory-select">
              <option value="">🤖 自动路由（AI 董事会）</option>
              <option value="deepseek-chat">🔧 DeepSeek — 深度逻辑</option>
              <option value="gemini">🧠 Gemini — 战略调度</option>
              <option value="doubao">🎨 豆包 — 创意营销</option>
              <option value="openai">📋 OpenAI — 标准化审计</option>
            </select>
            <button onClick={handleSubmitTask} disabled={submitting}
              style={{ ...S.btnPrimary, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? '⏳ 启动中...' : '🚀 启动生产'}
            </button>
          </div>

          {/* Stream Controls */}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', color: '#8b949e' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: wsConnected ? '#3fb950' : '#f85149',
                boxShadow: wsConnected ? '0 0 6px #3fb950' : 'none',
              }} />
              {wsConnected ? '已连接' : '未连接'}
            </div>
            <button onClick={clearLogs} style={S.btnSmall}>🗑️ 清空日志</button>
            <button onClick={() => setAutoScroll(!autoScroll)}
              style={{ ...S.btnSmall, background: autoScroll ? 'rgba(63,185,80,.15)' : 'rgba(255,255,255,.06)', color: autoScroll ? '#3fb950' : '#8b949e' }}>
              {autoScroll ? '📜 自动滚动: ON' : '📜 自动滚动: OFF'}
            </button>
            <span style={{ fontSize: '.75rem', color: '#484f58' }}>{logs.length} 条日志</span>
          </div>

          {/* Live Stream */}
          <div ref={streamRef} className="factory-stream" style={{
            ...S.liveStream, display: logs.length > 0 ? 'block' : 'none',
          }}>
            {logs.length === 0 && (
              <div className="factory-entry">
                <Tag type="info">INFO</Tag>
                <span style={{ color: '#8b949e' }}>连接到服务器后，AI 工厂的实时生产日志将显示在这里...</span>
              </div>
            )}
            {logs.map(entry => (
              <div key={entry.id} className="factory-entry">
                <span style={{ color: '#484f58', fontSize: '.75rem', marginRight: '.5rem' }}>{formatTime(entry.time)}</span>
                <Tag type={entry.tag}>{entry.tag.toUpperCase()}</Tag>
                <span style={{ color: '#c9d1d9' }}>{esc(entry.msg)}</span>
                {entry.code && (
                  <div style={{
                    background: 'rgba(0,0,0,.3)', borderLeft: '2px solid #58a6ff',
                    padding: '.5rem', margin: '.3rem 0', borderRadius: '4px',
                    fontSize: '.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    maxHeight: '120px', overflowY: 'auto', color: '#a5d6ff',
                  }}>{esc(entry.code)}</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── AI Board + Artifacts (2-column) ───────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* AI Board */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            style={S.card} className="factory-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ ...S.cardTitle, marginBottom: 0 }}><span>🤖</span> AI 董事会</h2>
              <div style={{ display: 'flex', gap: '.3rem' }}>
                {['all', 'active', 'idle'].map(f => (
                  <button key={f} onClick={() => setAgentConsoleFilter(f)}
                    style={{
                      padding: '.25rem .6rem', borderRadius: '6px', border: 'none',
                      fontSize: '.7rem', fontWeight: 600, cursor: 'pointer',
                      background: agentConsoleFilter === f ? 'rgba(88,166,255,.2)' : 'rgba(255,255,255,.04)',
                      color: agentConsoleFilter === f ? '#58a6ff' : '#8b949e',
                      textTransform: 'uppercase', letterSpacing: '.3px',
                      transition: 'all .3s',
                    }}>{f === 'all' ? '全部' : f === 'active' ? '活跃' : '空闲'}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem', maxHeight: '320px', overflowY: 'auto' }} className="factory-stream">
              {filteredConsoleAgents.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#484f58', padding: '2rem 0' }}>
                  🤷 暂无 AI 董事会数据
                </div>
              )}
              {filteredConsoleAgents.map((agent, i) => {
                const st = (agent.status || 'idle').toLowerCase()
                const dotColor = st === 'active' ? '#3fb950' : st === 'idle' ? '#d29922' : '#484f58'
                const busy = agent.current_task
                return (
                  <motion.div key={agent.signature || i} initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                    className="factory-board-card"
                    style={S.artifactCard}>
                    <div style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '.4rem', color: '#c9d1d9' }}>
                      🤖 {agent.name || agent.signature?.slice(0, 8)}
                      {busy && <span style={{ display: 'inline-block', padding: '.1rem .35rem', borderRadius: '4px', fontSize: '.65rem', background: 'rgba(210,153,34,.15)', color: '#d29922', marginLeft: '.2rem' }}>工作中</span>}
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: '.5rem' }}>{agent.role || 'AI Agent'}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3fb950' }}>
                      ${(agent.balance || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '.73rem', color: '#484f58', marginTop: '.3rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: dotColor }} />
                      {agent.status || 'Idle'}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Console Artifacts */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={S.card} className="factory-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ ...S.cardTitle, marginBottom: 0 }}><span>📦</span> 实时工件</h2>
              <div style={{ display: 'flex', gap: '.3rem', overflowX: 'auto', flexShrink: 0 }}>
                {ARTIFACT_FILTERS.map(f => (
                  <button key={f.key} onClick={() => setArtFilter(f.key)}
                    style={{
                      padding: '.25rem .6rem', borderRadius: '6px', border: 'none',
                      fontSize: '.7rem', fontWeight: 600, cursor: 'pointer',
                      background: artFilter === f.key ? (f.key === 'all' ? 'rgba(88,166,255,.2)' : 'rgba(188,140,255,.2)') : 'rgba(255,255,255,.04)',
                      color: artFilter === f.key ? (f.key === 'all' ? '#58a6ff' : '#bc8cff') : '#8b949e',
                      transition: 'all .3s', whiteSpace: 'nowrap',
                    }}>{f.label}</button>
                ))}
                <button onClick={fetchArtifactsData}
                  style={{ padding: '.25rem .6rem', borderRadius: '6px', border: 'none', fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,.06)', color: '#8b949e', transition: 'all .3s' }}>🔄</button>
              </div>
            </div>
            <div style={{ maxHeight: '320px', overflowY: 'auto' }} className="factory-stream">
              {artLoading ? (
                <div style={{ textAlign: 'center', color: '#484f58', padding: '2rem 0' }}>⏳ 加载工件中...</div>
              ) : filteredArtifacts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#484f58', padding: '2rem 0' }}>
                  📭 {artFilter !== 'all' ? '没有匹配的工件类型' : '暂无实时工件'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {filteredArtifacts.map((artifact, i) => {
                    const ext = artifact.extension || ''
                    const isHtml = ext === '.html' || ext === '.htm'
                    return (
                      <motion.div key={artifact.path || i} initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="factory-artifact-card"
                        style={{ ...S.artifactCard, cursor: 'default', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isHtml ? 'rgba(188,140,255,.15)' : 'rgba(255,255,255,.04)' }}>
                          {isHtml ? <Globe className="w-4 h-4" style={{ color: '#bc8cff' }} /> : (EXT_ICON[ext] || '📄')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.filename}</span>
                            <span style={{ fontSize: '.65rem', padding: '.1rem .35rem', borderRadius: '4px', background: 'rgba(255,255,255,.06)', color: '#8b949e', flexShrink: 0 }}>{ext}</span>
                          </div>
                          <div style={{ fontSize: '.7rem', color: '#484f58', marginTop: '.2rem', display: 'flex', gap: '.75rem' }}>
                            <span>{artifact.agent || 'AI'}</span>
                            <span>{artifact.date || '-'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
                          <a href={getArtifactFileUrl(artifact.path)} download={artifact.filename}
                            onClick={e => e.stopPropagation()}
                            style={{ padding: '.3rem', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: '#8b949e', fontSize: '.8rem', transition: 'all .2s', display: 'inline-flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#3fb950'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                            title="下载">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <a href={getArtifactFileUrl(artifact.path)} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ padding: '.3rem', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: '#8b949e', fontSize: '.8rem', transition: 'all .2s', display: 'inline-flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#58a6ff'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                            title="预览">
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: JSONL HISTORICAL LEDGER                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        {/* ── Ledger Filters ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ ...S.card, marginBottom: '1rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}
          className="factory-card">
          <Search className="w-4 h-4" style={{ color: '#484f58', flexShrink: 0 }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索任务 ID、Agent、行业、职业..."
            style={{ ...S.input, minWidth: '200px', flex: 2 }} className="factory-search" />
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            style={{ ...S.select, minWidth: '140px', flex: 1 }} className="factory-select">
            <option value="all">🤖 所有 Agent</option>
            {allLedgerAgents.map(a => (
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

        {/* ── Ledger Table ────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={S.card} className="factory-card">
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

          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#484f58' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>⏳</div>
              正在读取 JSONL 账本...
            </div>
          )}
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
          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#484f58' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📭</div>
              <p>暂无匹配的生产记录</p>
            </div>
          )}

          {!loading && !error && filtered.map((c, i) => (
            <motion.div key={c.task_id} initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.015, 0.5) }}
              className="factory-row" style={S.tableRow}>
              <span style={{ fontFamily: "'SF Mono','Consolas',monospace", fontSize: '.75rem', color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.task_id.slice(0, 12)}...
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: c.work_submitted ? '#3fb950' : '#d29922', flexShrink: 0 }} />
                {c.agent_signature}
              </span>
              <span style={{ color: '#8b949e', fontSize: '.8rem' }}>{formatDate(c.date)}</span>
              <span style={{ fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ ...S.badge, background: 'rgba(88,166,255,.1)', color: '#79c0ff' }}>{c.sector?.slice(0, 20) || '—'}</span>
                <span style={{ color: '#484f58', margin: '0 .2rem' }}>/</span>
                <span style={{ color: '#8b949e' }}>{c.occupation?.slice(0, 15) || '—'}</span>
              </span>
              <span style={{ fontWeight: 600, color: c.money_earned > 0 ? '#3fb950' : '#484f58' }}>
                {c.money_earned > 0 ? `$${c.money_earned.toFixed(2)}` : '—'}
              </span>
              <span style={{ color: '#8b949e', fontSize: '.8rem' }}>{formatDuration(c.wall_clock_seconds)}</span>
              <span>
                {c.has_artifacts ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                    {c.artifacts.slice(0, 2).map((a, j) => (
                      <div key={j} style={S.artifactBadge}>
                        <FileText className="w-3 h-3" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', whiteSpace: 'nowrap' }}>{a.filename}</span>
                        <a href={`/api/artifacts/file?path=${encodeURIComponent(a.path)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: '#bc8cff', display: 'inline-flex' }}
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    ))}
                    {c.artifacts.length > 2 && (
                      <span style={{ fontSize: '.65rem', color: '#484f58' }}>+{c.artifacts.length - 2} 更多</span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#484f58', fontSize: '.75rem' }}>—</span>
                )}
              </span>
              <span>
                {c.work_submitted ? (
                  <span style={{ ...S.badge, background: 'rgba(63,185,80,.12)', color: '#3fb950' }}>
                    <CheckCircle className="w-3 h-3" />完成
                  </span>
                ) : (
                  <span style={{ ...S.badge, background: 'rgba(210,153,34,.12)', color: '#d29922' }}>
                    <Clock className="w-3 h-3" />进行中
                  </span>
                )}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div style={S.footer}>
          AI 工厂 · 生产控制台 + JSONL 账本 (economic/task_completions.jsonl) · 全屏独立路由 /factory · 与主仪表盘完全解耦
        </div>
      </div>
    </div>
  )
}

export default FactoryPage