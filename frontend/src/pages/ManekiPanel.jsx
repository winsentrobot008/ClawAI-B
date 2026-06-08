import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Download, Trash2, Eye, Globe, FolderOpen, Shuffle,
  ChevronRight, Zap, Activity, Cpu, Database, Terminal,
  Play, AlertCircle
} from 'lucide-react'
import {
  fetchArtifacts as apiFetchArtifacts,
  getArtifactFileUrl,
  getArtifactPreviewUrl,
  deleteArtifact,
  submitTask,
  fetchAgents
} from '../api'
import { EXT_CONFIG, formatBytes, getFileIcon } from '../components/FilePreview'
import ArtifactControlCabin from '../components/ArtifactControlCabin'

// ─── Inline dark-theme styles matching Maneki-AI ──────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0d1117,#161b22,#0d1117)',
    color: '#c9d1d9',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
    padding: '2rem 1rem',
    boxSizing: 'border-box' ,
  },
  container: { maxWidth: '1200px', width: '100%', margin: '0 auto' },
  headerTitle: {
    fontSize: '2.2rem', fontWeight: 700, textAlign: 'center',
    background: 'linear-gradient(90deg,#58a6ff,#3fb950,#58a6ff)',
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'shimmerGradient 3s ease-in-out infinite',
    marginBottom: '0.5rem',
  },
  headerSub: { color: '#8b949e', textAlign: 'center', fontSize: '.95rem', marginTop: '.5rem' },
  card: {
    background: 'rgba(255,255,255,.03)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,.06)',
    borderRadius: '16px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    transition: 'border-color .3s, box-shadow .3s',
  },
  cardHover: { borderColor: 'rgba(88,166,255,.15)', boxShadow: '0 0 30px rgba(88,166,255,.04)' },
  cardTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '.5rem' },
  input: {
    flex: 1, minWidth: '200px', padding: '.75rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#c9d1d9', fontSize: '.95rem', outline: 'none',
    transition: 'border-color .3s',
  },
  select: {
    padding: '.75rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#c9d1d9', fontSize: '.95rem', outline: 'none', cursor: 'pointer',
  },
  btnPrimary: {
    padding: '.75rem 1.5rem', borderRadius: '10px', border: 'none',
    fontSize: '.95rem', fontWeight: 600, cursor: 'pointer',
    background: 'linear-gradient(135deg,#238636,#3fb950)', color: '#fff',
    transition: 'all .3s', display: 'inline-flex', alignItems: 'center', gap: '.5rem',
  },
  btnDanger: {
    padding: '.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(248,81,73,.25)',
    fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
    background: 'rgba(248,81,73,.15)', color: '#f85149',
    transition: 'all .3s',
  },
  btnSmall: {
    padding: '.4rem .75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,.08)',
    fontSize: '.8rem', fontWeight: 500, cursor: 'pointer',
    background: 'rgba(255,255,255,.06)', color: '#8b949e',
    transition: 'all .3s',
  },
  liveStream: {
    marginTop: '1rem', padding: '1rem', borderRadius: '10px',
    background: 'rgba(0,0,0,.3)', minHeight: '200px', maxHeight: '400px',
    overflowY: 'auto', fontSize: '.85rem', lineHeight: '1.6',
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
  },
  statItem: {
    textAlign: 'center', padding: '.75rem', background: 'rgba(255,255,255,.02)',
    borderRadius: '10px',
  },
  statValue: { fontSize: '1.4rem', fontWeight: 700, color: '#58a6ff' },
  statLabel: { fontSize: '.7rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: '.2rem' },
  tagCommon: {
    display: 'inline-block', padding: '.1rem .4rem', borderRadius: '4px',
    fontSize: '.7rem', fontWeight: 600, marginRight: '.4rem', textTransform: 'uppercase',
  },
  artifactCard: {
    background: 'rgba(255,255,255,.03)', borderRadius: '12px', padding: '1rem',
    border: '1px solid rgba(255,255,255,.05)', transition: 'all .3s', cursor: 'pointer',
  },
}

// ─── Tag color map ────────────────────────────────────────────────────────
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

// ─── Emoji icons per extension ────────────────────────────────────────────
const EXT_ICON = {
  '.pdf': '📄', '.docx': '📝', '.xlsx': '📊', '.pptx': '📽️',
  '.html': '🌐', '.htm': '🌐', '.json': '📋', '.txt': '📃',
  '.csv': '📑', '.md': '📘', '.py': '🐍', '.js': '🟨', '.ts': '🔷',
}

// ─── Full filter list (matching Artifacts.jsx) ───────────────────────────────
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: '.pdf', label: 'PDF' },
  { key: '.docx', label: 'DOCX' },
  { key: '.xlsx', label: 'XLSX' },
  { key: '.pptx', label: 'PPTX' },
  { key: '.html', label: 'HTML' },
]

// ─── Utils ────────────────────────────────────────────────────────────────
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML }
function getTagStyle(tag) { return TAG_STYLES[tag] || TAG_STYLES.info }
function formatTime(d) { return d.toLocaleTimeString() }

// ─── Main Component ───────────────────────────────────────────────────────
const ManekiPanel = () => {
  // ── State ──────────────────────────────────────────────────────────────
  const [taskInput, setTaskInput] = useState('')
  const [modelRoute, setModelRoute] = useState('')
  const [logs, setLogs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const streamRef = useRef(null)
  const wsRef = useRef(null)

  // Stats
  const [statAgents, setStatAgents] = useState(0)
  const [statArtifacts, setStatArtifacts] = useState(0)
  const [statDeleted, setStatDeleted] = useState(0)

  // Artifacts
  const [artifacts, setArtifacts] = useState([])
  const [artLoading, setArtLoading] = useState(true)
  const [previewArtifact, setPreviewArtifact] = useState(null)
  const [artFilter, setArtFilter] = useState('all')

  // Agents
  const [agents, setAgents] = useState([])
  const [agentFilter, setAgentFilter] = useState('all')

  // ── Auto-scroll effect ────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // ── Add log entry ─────────────────────────────────────────────────────
  const addLog = useCallback((tag, msg, code) => {
    const entry = { id: Date.now() + Math.random(), tag, msg, code, time: new Date() }
    setLogs(prev => {
      const next = [...prev, entry]
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  // ── WebSocket ─────────────────────────────────────────────────────────
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
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            // The effect cleanup will create a new connection
          }
        }, 3000)
      }
      ws.onerror = () => addLog('error', 'WebSocket 连接错误')
      wsRef.current = ws
    } catch (e) {
      addLog('error', `WebSocket 初始化失败: ${e.message}`)
    }
    return () => { if (ws) { ws.close(); wsRef.current = null } }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Fetch agents ──────────────────────────────────────────────────────
  const fetchAgentsData = useCallback(async () => {
    try {
      const data = await fetchAgents()
      const list = data.agents || []
      setAgents(list)
      setStatAgents(list.length)
    } catch { /* ignore */ }
  }, [])

  // ── Fetch artifacts ───────────────────────────────────────────────────
  const fetchArtifactsData = useCallback(async () => {
    try {
      setArtLoading(true)
      const data = await apiFetchArtifacts()
      const list = data.artifacts || []
      setArtifacts(list)
      setStatArtifacts(list.length)
    } catch { /* ignore */ } finally { setArtLoading(false) }
  }, [])

  // ── Initial data load ─────────────────────────────────────────────────
  useEffect(() => {
    fetchAgentsData()
    fetchArtifactsData()
    const ai = setInterval(fetchAgentsData, 10000)
    const ai2 = setInterval(fetchArtifactsData, 15000)
    return () => { clearInterval(ai); clearInterval(ai2) }
  }, [fetchAgentsData, fetchArtifactsData])

  // ── Submit task ───────────────────────────────────────────────────────
  const handleSubmitTask = async () => {
    const goal = taskInput.trim()
    if (!goal) { addLog('error', '⚠️ 请输入任务描述'); return }
    setSubmitting(true)
    addLog('info', `🏭 正在提交生产任务: ${goal.slice(0, 100)}...`)
    try {
      const res = await submitTask(goal, modelRoute || undefined)
      // Any non-throwing 2xx response from submitTask means success
      // Use green 'submit' tag to avoid false red ❌ in the log
      addLog('submit', `✅ 任务已创建! ID: ${res.task_id || '—'}`)
      setTaskInput('')
      // Isolate WebSocket notify so any send failure doesn't pollute the success UI
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'task_submitted', task_id: res.task_id, goal }))
        }
      } catch (_) { /* best-effort notify */ }
    } catch (e) {
      addLog('error', `❌ 提交失败: ${e.message}`)
    } finally { setSubmitting(false) }
  }

  // ── Handle keydown ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitTask() }
  }

  // ── Artifact delete ───────────────────────────────────────────────────
  const handleDelete = async (artifact) => {
    const taskId = artifact.path?.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
    try {
      await deleteArtifact(taskId)
      addLog('complete', `🗑️ 已删除: ${artifact.filename}`)
      setStatDeleted(s => s + 1)
      fetchArtifactsData()
    } catch {
      try {
        const pathTaskId = artifact.path?.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '')
        await deleteArtifact(pathTaskId)
        addLog('complete', `🗑️ 已删除: ${artifact.filename}`)
        setStatDeleted(s => s + 1)
        fetchArtifactsData()
      } catch (e2) {
        addLog('error', `删除失败: ${e2.message}`)
      }
    }
  }

  // ── Filtered artifacts ────────────────────────────────────────────────
  const filteredArtifacts = artFilter === 'all'
    ? artifacts
    : artifacts.filter(a => a.extension === artFilter)

  const filteredAgents = agentFilter === 'all'
    ? agents
    : agents.filter(a => (a.status || 'idle').toLowerCase() === agentFilter)

  // ── Artifact filters (unique extensions) ──────────────────────────────
  const availableExts = [...new Set(artifacts.map(a => a.extension).filter(Boolean))]

  // ── Tag helper ────────────────────────────────────────────────────────
  const Tag = ({ type, children }) => {
    const ts = getTagStyle(type)
    return <span style={{ ...S.tagCommon, ...ts }}>{children}</span>
  }

  // ── Clear logs ────────────────────────────────────────────────────────
  const clearLogs = () => setLogs([])

  return (
    <div style={S.page}>
      {/* Inject shimmer keyframes */}
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
        .maneki-entry {
          padding: 0.3rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.02);
          animation: fadeIn 0.3s ease;
        }
        .maneki-stream::-webkit-scrollbar { width: 6px; }
        .maneki-stream::-webkit-scrollbar-track { background: transparent; }
        .maneki-stream::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .maneki-card-hover:hover {
          border-color: rgba(88,166,255,0.15) !important;
          box-shadow: 0 0 30px rgba(88,166,255,0.04) !important;
        }
        .maneki-board-card:hover {
          background: rgba(255,255,255,0.06) !important;
          transform: translateY(-2px);
        }
        .maneki-artifact-card:hover {
          border-color: rgba(188,140,255,0.2) !important;
        }
      `}</style>

      <div style={S.container}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={S.headerTitle}>🏭 Maneki-AI 任务工厂</h1>
          <p style={S.headerSub}>AI 多智能体协作 · 实时流回传 · SQLite 持久化</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '.4rem',
              padding: '.3rem 1rem', borderRadius: '20px', fontSize: '.8rem', fontWeight: 600,
              background: wsConnected ? 'rgba(63,185,80,.15)' : 'rgba(248,81,73,.15)',
              color: wsConnected ? '#3fb950' : '#f85149',
              border: `1px solid ${wsConnected ? 'rgba(63,185,80,.3)' : 'rgba(248,81,73,.3)'}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: wsConnected ? '#3fb950' : '#f85149',
                boxShadow: wsConnected ? '0 0 6px #3fb950' : 'none',
              }} />
              {wsConnected ? '实时流已连接' : '实时流未连接'}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '.4rem',
              padding: '.3rem 1rem', borderRadius: '20px', fontSize: '.8rem', fontWeight: 600,
              background: 'rgba(210,153,34,.15)', color: '#d29922',
              border: '1px solid rgba(210,153,34,.3)',
            }}>
              ⚡ 生产模式
            </span>
          </div>
        </motion.div>

        {/* ── Stats Row ──────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
          {[
            { value: statAgents, label: 'AI 董事会成员', color: '#58a6ff' },
            { value: statArtifacts, label: '生产工件总数', color: '#bc8cff' },
            { value: filteredArtifacts.length, label: '当前筛选', color: '#3fb950' },
            { value: statDeleted, label: '已清理工件', color: '#f85149' },
          ].map((s, i) => (
            <div key={i} style={S.statItem}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 + i * 0.1, type: 'spring' }}
                style={{ ...S.statValue, color: s.color }}>{s.value}</motion.div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Task Input Card ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={S.card} className="maneki-card-hover">
          <h2 style={S.cardTitle}><span>🎯</span> 提交生产任务</h2>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <input type="text" value={taskInput} onChange={e => setTaskInput(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="输入任务描述，例如：生成一份市场分析报告..."
              style={{ ...S.input, minWidth: '250px', flex: 2 }} />
            <select value={modelRoute} onChange={e => setModelRoute(e.target.value)} style={{ ...S.select, minWidth: '180px', flex: 1 }}>
              <option value="">🤖 自动路由（AI 董事会）</option>
              <option value="deepseek-chat">🔧 DeepSeek — 深度逻辑</option>
              <option value="gemini">🧠 Gemini — 战略调度</option>
              <option value="doubao">🎨 豆包 — 创意营销</option>
              <option value="openai">📋 OpenAI — 标准化审计</option>
            </select>
            <button onClick={handleSubmitTask} disabled={submitting}
              style={{
                ...S.btnPrimary, opacity: submitting ? 0.6 : 1,
                transform: submitting ? 'none' : undefined,
                boxShadow: submitting ? 'none' : undefined,
              }}>
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
          <div ref={streamRef} className="maneki-stream" style={{
            ...S.liveStream, display: logs.length > 0 ? 'block' : 'none',
          }}>
            {logs.length === 0 && (
              <div className="maneki-entry">
                <Tag type="info">INFO</Tag>
                <span style={{ color: '#8b949e' }}>连接到服务器后，AI 工厂的实时生产日志将显示在这里...</span>
              </div>
            )}
            {logs.map(entry => (
              <div key={entry.id} className="maneki-entry">
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

        {/* ── Two-column layout: Board + Artifacts ──────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* ── AI Board ──────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={S.card} className="maneki-card-hover">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ ...S.cardTitle, marginBottom: 0 }}><span>🤖</span> AI 董事会</h2>
              <div style={{ display: 'flex', gap: '.3rem' }}>
                {['all', 'active', 'idle'].map(f => (
                  <button key={f} onClick={() => setAgentFilter(f)}
                    style={{
                      padding: '.25rem .6rem', borderRadius: '6px', border: 'none',
                      fontSize: '.7rem', fontWeight: 600, cursor: 'pointer',
                      background: agentFilter === f ? 'rgba(88,166,255,.2)' : 'rgba(255,255,255,.04)',
                      color: agentFilter === f ? '#58a6ff' : '#8b949e',
                      textTransform: 'uppercase', letterSpacing: '.3px',
                      transition: 'all .3s',
                    }}>{f === 'all' ? '全部' : f === 'active' ? '活跃' : '空闲'}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem' }}>
              {filteredAgents.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#484f58', padding: '2rem 0' }}>
                  🤷 {agentFilter === 'all' ? '暂无 AI 董事会数据' : '没有匹配状态的 Agent'}
                </div>
              )}
              {filteredAgents.map((agent, i) => {
                const st = (agent.status || 'idle').toLowerCase()
                const dotColor = st === 'active' ? '#3fb950' : st === 'idle' ? '#d29922' : '#484f58'
                const busy = agent.current_task
                return (
                  <motion.div key={agent.signature || i} initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                    className="maneki-board-card"
                    style={S.artifactCard}>
                    <div style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '.4rem', color: '#c9d1d9' }}>
                      {agent.icon || '🤖'} {agent.name || agent.signature?.slice(0, 8)}
                      {busy && <span style={{
                        display: 'inline-block', padding: '.1rem .35rem', borderRadius: '4px',
                        fontSize: '.65rem', background: 'rgba(210,153,34,.15)', color: '#d29922', marginLeft: '.2rem',
                      }}>工作中</span>}
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: '.5rem' }}>{agent.role || 'AI Agent'}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3fb950' }}>
                      {agent.tasks || 0} 个任务 · ${(agent.revenue || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '.73rem', color: '#484f58', marginTop: '.3rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: dotColor }} />
                      {agent.status || 'Idle'} · 成功率: {(agent.success_rate || 0)}%
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* ── Artifacts Panel ──────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            style={S.card} className="maneki-card-hover">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ ...S.cardTitle, marginBottom: 0 }}><span>📦</span> 生产工件</h2>
              <div style={{ display: 'flex', gap: '.3rem', overflowX: 'auto', flexShrink: 0 }}>
                {FILTERS.map(f => (
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
                  style={{
                    padding: '.25rem .6rem', borderRadius: '6px', border: 'none',
                    fontSize: '.7rem', fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(255,255,255,.06)', color: '#8b949e',
                    transition: 'all .3s',
                  }}>🔄</button>
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }} className="maneki-stream">
              {artLoading ? (
                <div style={{ textAlign: 'center', color: '#484f58', padding: '2rem 0' }}>⏳ 加载工件中...</div>
              ) : filteredArtifacts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#484f58', padding: '2rem 0' }}>
                  📭 {artFilter !== 'all' ? '没有匹配的工件类型' : '暂无生产工件，请先提交任务'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {filteredArtifacts.map((artifact, i) => {
                    const config = EXT_CONFIG[artifact.extension] || EXT_CONFIG['.pdf']
                    const ext = artifact.extension || ''
                    const isHtml = ext === '.html' || ext === '.htm'
                    return (
                      <motion.div key={artifact.path || i} initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="maneki-artifact-card"
                        style={{
                          ...S.artifactCard, cursor: 'default',
                          display: 'flex', alignItems: 'center', gap: '.75rem',
                        }}>
                        {/* Icon */}
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          background: isHtml ? 'rgba(188,140,255,.15)' : 'rgba(255,255,255,.04)',
                        }}>
                          {isHtml ? <Globe className="w-4 h-4" style={{ color: '#bc8cff' }} /> : (EXT_ICON[ext] || '📄')}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.filename}</span>
                            <span style={{
                              fontSize: '.65rem', padding: '.1rem .35rem', borderRadius: '4px',
                              background: 'rgba(255,255,255,.06)', color: '#8b949e', flexShrink: 0,
                            }}>{ext}</span>
                          </div>
                          <div style={{ fontSize: '.7rem', color: '#484f58', marginTop: '.2rem', display: 'flex', gap: '.75rem' }}>
                            <span>{artifact.agent || 'AI'}</span>
                            <span>{artifact.date || '-'}</span>
                            <span>{formatBytes(artifact.size_bytes) || ''}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
                          <button onClick={() => setPreviewArtifact(artifact)}
                            style={{
                              padding: '.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                              background: 'transparent', color: '#8b949e', fontSize: '.8rem',
                              transition: 'all .2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#58a6ff'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                            title="预览">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a href={getArtifactFileUrl(artifact.path)} download={artifact.filename}
                            onClick={e => e.stopPropagation()}
                            style={{
                              padding: '.3rem', borderRadius: '6px', cursor: 'pointer',
                              background: 'transparent', color: '#8b949e', fontSize: '.8rem',
                              transition: 'all .2s', display: 'inline-flex', alignItems: 'center',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#3fb950'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                            title="下载">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={() => handleDelete(artifact)}
                            style={{
                              padding: '.3rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                              background: 'transparent', color: '#8b949e', fontSize: '.8rem',
                              transition: 'all .2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#f85149'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
                            title="删除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── API Info Footer ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          style={S.card} className="maneki-card-hover">
          <h2 style={S.cardTitle}><span>🔗</span> 数据通道</h2>
          <div style={{ fontSize: '.85rem', lineHeight: '1.8', color: '#8b949e' }}>
            <div><code style={{ background: 'rgba(255,255,255,.04)', padding: '.15rem .4rem', borderRadius: '4px' }}>POST /api/tasks/submit</code> — 提交任务 → AI 董事会自动路由</div>
            <div><code style={{ background: 'rgba(255,255,255,.04)', padding: '.15rem .4rem', borderRadius: '4px' }}>GET /api/artifacts/random?count=30</code> — SQLite 工件查询</div>
            <div><code style={{ background: 'rgba(255,255,255,.04)', padding: '.15rem .4rem', borderRadius: '4px' }}>DELETE /api/artifacts/delete/{'{id}'}</code> — 工件删除（持久化）</div>
            <div><code style={{ background: 'rgba(255,255,255,.04)', padding: '.15rem .4rem', borderRadius: '4px' }}>WS /ws</code> — WebSocket 实时生产流</div>
            <div><code style={{ background: 'rgba(255,255,255,.04)', padding: '.15rem .4rem', borderRadius: '4px' }}>GET /api/agents</code> — AI 董事会成员状态</div>
          </div>
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer style={{ marginTop: '2rem', textAlign: 'center', color: '#30363d', fontSize: '.8rem' }}>
          Maneki-AI 任务工厂 · SQLite 持久化引擎 · 实时 WebSocket 流 · v1.0.0
        </footer>
      </div>

      {/* ── Artifact Control Cabin ────────────────────────────────────────── */}
      <AnimatePresence>
        {previewArtifact && (
          <ArtifactControlCabin artifact={previewArtifact}
            onClose={(reason) => {
              setPreviewArtifact(null)
              if (reason === 'deleted') fetchArtifactsData()
            }}
            onDelete={handleDelete}
            onRefreshed={fetchArtifactsData}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ManekiPanel
