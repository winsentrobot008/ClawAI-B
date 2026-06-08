import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  X, Download, Trash2, Globe, Package, FileText, Send,
  ChevronLeft, ChevronRight, Loader, AlertCircle, CheckCircle,
  BookOpen, Zap
} from 'lucide-react'
import {
  getArtifactFileUrl,
  getArtifactPreviewUrl,
  refineArtifact,
  getArtifactDocs,
  getArtifactPackUrl,
  deleteArtifact,
} from '../api'

// ─── Dark theme styles matching Maneki-AI ───────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  cabin: {
    background: '#0d1117', borderRadius: '16px', maxWidth: '1400px', width: '100%',
    maxHeight: '96vh', height: '96vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)',
    boxShadow: '0 0 60px rgba(88,166,255,.06)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,.06)',
    flexShrink: 0, minHeight: '56px',
  },
  headerTitle: { fontWeight: 600, color: '#c9d1d9', fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: '.5rem' },
  headerSub: { fontSize: '.75rem', color: '#8b949e', marginLeft: '.5rem' },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  leftPanel: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  iframeContainer: { flex: 1, padding: '1rem', background: '#161b22' },
  iframe: { width: '100%', height: '100%', borderRadius: '8px', border: 'none', background: '#fff' },
  rightPanel: {
    width: '380px', minWidth: '380px', borderLeft: '1px solid rgba(255,255,255,.06)',
    display: 'flex', flexDirection: 'column', background: '#0d1117', flexShrink: 0,
    overflow: 'hidden',
  },
  rightPanelTabs: {
    display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0,
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  tab: {
    padding: '.6rem .85rem', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
    border: 'none', background: 'transparent', color: '#8b949e', whiteSpace: 'nowrap',
    transition: 'all .2s', display: 'flex', alignItems: 'center', gap: '.35rem',
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#58a6ff', borderBottomColor: '#58a6ff', background: 'rgba(88,166,255,.06)' },
  panelContent: { flex: 1, overflow: 'auto', padding: '1rem' },
  input: {
    width: '100%', padding: '.65rem .85rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#c9d1d9', fontSize: '.85rem', outline: 'none', resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color .2s',
  },
  btnPrimary: {
    padding: '.5rem 1rem', borderRadius: '8px', border: 'none',
    fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
    background: 'linear-gradient(135deg,#238636,#3fb950)', color: '#fff',
    transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: '.4rem',
  },
  btnDanger: {
    padding: '.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(248,81,73,.25)',
    fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
    background: 'rgba(248,81,73,.15)', color: '#f85149',
    transition: 'all .2s',
  },
  btnGhost: {
    padding: '.4rem .75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,.08)',
    fontSize: '.75rem', fontWeight: 500, cursor: 'pointer',
    background: 'rgba(255,255,255,.04)', color: '#8b949e',
    transition: 'all .2s',
  },
  tag: {
    info: { background: 'rgba(88,166,255,.15)', color: '#79c0ff' },
    success: { background: 'rgba(63,185,80,.15)', color: '#3fb950' },
    error: { background: 'rgba(248,81,73,.15)', color: '#f85149' },
    warning: { background: 'rgba(210,153,34,.15)', color: '#d29922' },
  },
  docContent: {
    fontSize: '.85rem', lineHeight: '1.7', color: '#c9d1d9',
  },
}

// ─── Tab enum ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'refine', label: '持续改进', icon: Send },
  { key: 'docs', label: '说明书', icon: BookOpen },
  { key: 'pack', label: '打包', icon: Package },
  { key: 'actions', label: '下载 & 删除', icon: Zap },
]

// ─── Main Component ─────────────────────────────────────────────────────────
const ArtifactControlCabin = ({ artifact, onClose, onDelete, onRefreshed }) => {
  const [activeTab, setActiveTab] = useState('refine')
  const [refineInput, setRefineInput] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineStatus, setRefineStatus] = useState(null) // { type: 'success'|'error', msg }
  const [docs, setDocs] = useState(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [packing, setPacking] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isHtml = artifact.extension === '.html' || artifact.extension === '.htm'
  const taskId = artifact.path?.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
  const fileUrl = getArtifactFileUrl(artifact.path)
  const previewUrl = isHtml
    ? getArtifactPreviewUrl(taskId)
    : fileUrl

  // ── Load docs on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'docs' && !docs && !docsLoading) {
      setDocsLoading(true)
      getArtifactDocs(taskId)
        .then(setDocs)
        .catch(() => setDocs({ markdown_content: '*文档暂不可用*' }))
        .finally(() => setDocsLoading(false))
    }
  }, [activeTab, taskId, docs, docsLoading])

  // ── Handle refine submit ──────────────────────────────────────────────
  const handleRefine = async () => {
    const instr = refineInput.trim()
    if (!instr) {
      setRefineStatus({ type: 'warning', msg: '请输入改进指令' })
      return
    }
    setRefining(true)
    setRefineStatus(null)
    try {
      const res = await refineArtifact(taskId, instr, artifact.filename || '')
      setRefineStatus({ type: 'success', msg: `✅ 改进任务已提交! ID: ${res.task_id?.slice(-8)}` })
      setRefineInput('')
      if (onRefreshed) setTimeout(onRefreshed, 2000)
    } catch (e) {
      setRefineStatus({ type: 'error', msg: `❌ 提交失败: ${e.message}` })
    } finally {
      setRefining(false)
    }
  }

  // ── Handle pack ───────────────────────────────────────────────────────
  const handlePack = () => {
    setPacking(true)
    const url = getArtifactPackUrl(taskId)
    if (url) {
      window.open(url, '_blank')
      setTimeout(() => setPacking(false), 1500)
    } else {
      setPacking(false)
    }
  }

  // ── Handle download ───────────────────────────────────────────────────
  const handleDownload = () => {
    window.open(fileUrl, '_blank')
  }

  // ── Handle delete ─────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await deleteArtifact(taskId)
      onDelete(artifact)
      onClose('deleted')
    } catch {
      // Fallback path-based delete
      try {
        const pathTaskId = artifact.path?.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '')
        await deleteArtifact(pathTaskId)
        onDelete(artifact)
        onClose('deleted')
      } catch (e2) {
        setRefineStatus({ type: 'error', msg: `❌ 删除失败: ${e2.message}` })
      }
    } finally {
      setDeleting(false)
      setShowConfirmDelete(false)
    }
  }

  // ── Render right panel content ────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'refine':
        return (
          <div>
            <h3 style={{ fontSize: '.9rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <Send className="w-4 h-4" style={{ color: '#58a6ff' }} />
              持续改进输入
            </h3>
            <p style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: '.75rem' }}>
              输入新的改进指令，Agent 将针对此工件进行迭代重构：
            </p>
            <textarea
              value={refineInput}
              onChange={e => setRefineInput(e.target.value)}
              placeholder="例如：把配色改成深蓝色主题，增加响应式布局..."
              rows={4}
              style={S.input}
              onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleRefine() } }}
            />
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', alignItems: 'center' }}>
              <button onClick={handleRefine} disabled={refining}
                style={{
                  ...S.btnPrimary, opacity: refining ? 0.6 : 1,
                }}>
                {refining ? <Loader className="w-3.5 h-3.5" style={{ animation: 'spin 1s linear infinite' }} /> : <Send className="w-3.5 h-3.5" />}
                {refining ? '提交中...' : '提交改进'}
              </button>
            </div>

            {/* Status messages */}
            <AnimatePresence>
              {refineStatus && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    marginTop: '.75rem', padding: '.5rem .75rem', borderRadius: '8px', fontSize: '.8rem',
                    display: 'flex', alignItems: 'center', gap: '.4rem',
                    ...(S.tag[refineStatus.type] || S.tag.info),
                  }}>
                  {refineStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> :
                   refineStatus.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                   refineStatus.type === 'warning' ? <AlertCircle className="w-3.5 h-3.5" /> : null}
                  {refineStatus.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )

      case 'docs':
        return (
          <div>
            <h3 style={{ fontSize: '.9rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <BookOpen className="w-4 h-4" style={{ color: '#58a6ff' }} />
              说明书
            </h3>
            {docsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '.5rem', color: '#8b949e', fontSize: '.85rem' }}>
                <Loader className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
                加载文档中...
              </div>
            ) : docs ? (
              <div style={S.docContent} className="markdown-content">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#c9d1d9', margin: '0 0 .5rem', paddingBottom: '.4rem', borderBottom: '1px solid rgba(255,255,255,.06)' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#c9d1d9', margin: '1rem 0 .35rem' }}>{children}</h2>,
                    p: ({ children }) => <p style={{ margin: '.35rem 0', color: '#c9d1d9' }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ color: '#58a6ff' }}>{children}</strong>,
                    code: ({ children }) => <code style={{ background: 'rgba(255,255,255,.06)', padding: '.15rem .4rem', borderRadius: '4px', fontSize: '.8rem', color: '#a5d6ff' }}>{children}</code>,
                    ul: ({ children }) => <ul style={{ paddingLeft: '1.2rem', margin: '.35rem 0' }}>{children}</ul>,
                    li: ({ children }) => <li style={{ margin: '.2rem 0', color: '#c9d1d9' }}>{children}</li>,
                    hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,.06)', margin: '.75rem 0' }} />,
                    em: ({ children }) => <em style={{ color: '#8b949e' }}>{children}</em>,
                  }}
                >
                  {docs.markdown_content}
                </ReactMarkdown>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#484f58', padding: '2rem 0', fontSize: '.85rem' }}>
                文档不可用
              </div>
            )}
          </div>
        )

      case 'pack':
        return (
          <div>
            <h3 style={{ fontSize: '.9rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <Package className="w-4 h-4" style={{ color: '#58a6ff' }} />
              打包
            </h3>
            <p style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: '1rem' }}>
              将此工件及其资产一键打包为 <code style={{ background: 'rgba(255,255,255,.06)', padding: '.1rem .3rem', borderRadius: '4px', fontSize: '.75rem' }}>.zip</code> 格式：
            </p>
            <button onClick={handlePack} disabled={packing}
              style={{
                ...S.btnPrimary, opacity: packing ? 0.6 : 1, width: '100%',
                justifyContent: 'center',
              }}>
              {packing ? (
                <><Loader className="w-3.5 h-3.5" style={{ animation: 'spin 1s linear infinite' }} /> 打包中...</>
              ) : (
                <><Package className="w-3.5 h-3.5" /> 打包下载 (.zip)</>
              )}
            </button>
            {packing && (
              <p style={{ fontSize: '.7rem', color: '#8b949e', marginTop: '.5rem', textAlign: 'center' }}>
                如果下载没有自动开始，请检查浏览器弹窗设置
              </p>
            )}
          </div>
        )

      case 'actions':
        return (
          <div>
            <h3 style={{ fontSize: '.9rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <Zap className="w-4 h-4" style={{ color: '#58a6ff' }} />
              下载 & 删除
            </h3>

            {/* File info */}
            <div style={{
              background: 'rgba(255,255,255,.03)', borderRadius: '8px',
              padding: '.75rem', marginBottom: '1rem',
              border: '1px solid rgba(255,255,255,.05)',
            }}>
              <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '.3rem' }}>
                {artifact.filename}
              </div>
              <div style={{ fontSize: '.7rem', color: '#8b949e', display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
                <span>📂 {artifact.agent || 'AI'}</span>
                <span>📅 {artifact.date || '-'}</span>
                <span>📏 {formatSize(artifact.size_bytes) || '-'}</span>
                <span>🔤 {artifact.extension || '-'}</span>
              </div>
            </div>

            {/* Download */}
            <button onClick={handleDownload}
              style={{
                ...S.btnGhost, width: '100%', justifyContent: 'center', marginBottom: '.5rem',
                background: 'rgba(63,185,80,.08)', borderColor: 'rgba(63,185,80,.2)', color: '#3fb950',
              }}>
              <Download className="w-3.5 h-3.5" />
              下载文件
            </button>

            {/* Open in new tab (HTML only) */}
            {isHtml && previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  ...S.btnGhost, width: '100%', justifyContent: 'center', marginBottom: '.5rem',
                  background: 'rgba(188,140,255,.08)', borderColor: 'rgba(188,140,255,.2)', color: '#bc8cff',
                  display: 'inline-flex', alignItems: 'center', gap: '.4rem', textDecoration: 'none',
                  boxSizing: 'border-box',
                }}>
                <Globe className="w-3.5 h-3.5" />
                新标签页打开
              </a>
            )}

            {/* Delete */}
            <button onClick={() => setShowConfirmDelete(true)} disabled={deleting}
              style={{
                ...S.btnDanger, width: '100%', justifyContent: 'center', marginTop: '.5rem',
                opacity: deleting ? 0.6 : 1,
              }}>
              {deleting ? (
                <><Loader className="w-3.5 h-3.5" style={{ animation: 'spin 1s linear infinite' }} /> 删除中...</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5" /> 删除工件</>
              )}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={S.overlay} onClick={() => onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()} style={S.cabin}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span style={S.headerTitle}>
              {isHtml ? <Globe className="w-4 h-4" style={{ color: '#bc8cff' }} /> : <FileText className="w-4 h-4" style={{ color: '#58a6ff' }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                {artifact.filename}
              </span>
              <span style={S.headerSub}>
                {artifact.agent} · {artifact.date}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0, alignItems: 'center' }}>
            <span style={{
              padding: '.2rem .6rem', borderRadius: '12px', fontSize: '.7rem', fontWeight: 600,
              background: isHtml ? 'rgba(188,140,255,.15)' : 'rgba(88,166,255,.1)',
              color: isHtml ? '#bc8cff' : '#58a6ff',
              border: `1px solid ${isHtml ? 'rgba(188,140,255,.2)' : 'rgba(88,166,255,.2)'}`,
            }}>
              {isHtml ? '🌐 独立运行' : '📄 预览'}
            </span>
            <button onClick={() => onClose()}
              style={{
                padding: '.4rem', borderRadius: '8px', color: '#8b949e', background: 'transparent',
                border: 'none', cursor: 'pointer', transition: 'all .2s', display: 'inline-flex',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={S.body}>
          {/* Left: Iframe */}
          <div style={S.leftPanel}>
            <div style={S.iframeContainer}>
              {isHtml && previewUrl ? (
                <iframe src={previewUrl} title="Artifact Preview"
                  style={S.iframe} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              ) : (
                <iframe src={fileUrl} title="File Preview"
                  style={S.iframe} />
              )}
            </div>
          </div>

          {/* Right: Control Wing */}
          <div style={S.rightPanel}>
            {/* Tabs */}
            <div style={S.rightPanelTabs}>
              {TABS.map(tab => {
                const Icon = tab.icon
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{
                      ...S.tab,
                      ...(activeTab === tab.key ? S.tabActive : {}),
                    }}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Content */}
            <div key={activeTab} style={S.panelContent}>
              {renderTabContent()}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Confirm Delete Dialog ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowConfirmDelete(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 120,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#1c2128', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px',
                width: '90%', border: '1px solid rgba(255,255,255,.08)',
              }}>
              <h3 style={{ color: '#c9d1d9', fontSize: '1.1rem', fontWeight: 600, marginBottom: '.5rem' }}>
                <Trash2 className="w-4 h-4" style={{ display: 'inline', marginRight: '.4rem', color: '#f85149' }} />
                删除工件
              </h3>
              <p style={{ color: '#8b949e', fontSize: '.85rem', marginBottom: '1.5rem' }}>
                确认删除 <strong style={{ color: '#c9d1d9' }}>{artifact.filename}</strong>？此操作不可撤销。
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}>
                <button onClick={() => setShowConfirmDelete(false)}
                  style={{
                    padding: '.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,.1)',
                    background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: '.8rem',
                  }}>取消</button>
                <button onClick={handleDeleteConfirm}
                  style={{
                    padding: '.5rem 1rem', borderRadius: '8px', border: 'none',
                    background: 'rgba(248,81,73,.8)', color: '#fff', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                  }}>确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Utility: format bytes ────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export default ArtifactControlCabin