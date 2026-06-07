import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'livebench_lang'

const LOCALES = {
  en: {
    // Sidebar
    livebench: "LiveBench",
    subtitle: "AI Survival Game",
    live: "Live",
    connecting: "Connecting",
    disconnected: "Disconnected",
    error: "Error",
    agentVisibility: "Agent Visibility",
    noAgentsDiscovered: "No agents discovered",
    apply: "Apply",
    leaderboard: "Leaderboard",
    dashboard: "Dashboard",
    artifacts: "Artifacts",
    workTasks: "Work Tasks",
    learning: "Learning",
    agents: "Agents",
    noAgentsRunning: "No agents running",
    starOnGitHub: "Star on GitHub",
    squidGame: "Squid Game for AI Agents",
    // Leaderboard
    failedToLoad: "Failed to load leaderboard",
    noAgentsFound: "No agents found",
    runSomeAgents: "Run some agents to see them on the leaderboard",
    competing: "competing",
    topPerformer: "Top Performer",
    balanceHistory: "Balance History",
    dataPoints: "data points",
    wallClockHrs: "Wall-clock hrs",
    cumulativeWorkHours: "Cumulative work hours",
    rank: "Rank",
    agent: "Agent",
    starter: "Starter",
    balance: "Balance",
    pctChange: "% Change",
    income: "Income",
    cost: "Cost",
    payRate: "Pay Rate",
    avgQuality: "Avg Quality",
    tasks: "Tasks",
    status: "Status",
    retry: "Retry",
    // Dashboard
    noAgentSelected: "No Agent Selected",
    selectAgentFromSidebar: "Select an agent from the sidebar to view details",
    agentDashboard: "Agent Dashboard - Live Monitoring",
    starterAsset: "Starter Asset",
    netWorth: "Net Worth",
    totalTokenCost: "Total Token Cost",
    workIncome: "Work Income",
    avgQualityScore: "Avg Quality Score",
    wallClockTime: "Wall-Clock Time",
    currentlyActive: "Currently Active",
    date: "Date",
    balanceHistoryTitle: "Balance History",
    domainEarnings: "Domain Earnings",
    earned: "Earned",
    failedWasted: "Failed & wasted",
    untappedPotential: "Untapped potential",
    noTaskDataYet: "No task data yet",
    recentDecisions: "Recent Decisions",
    // WorkView
    workTasksTitle: "Work Tasks",
    noTasksAgent: "No tasks found for this agent",
    selectAgent: "Select an agent to view tasks",
    allSectors: "All Sectors",
    completed: "Completed",
    task: "Task",
    occupation: "Occupation",
    sector: "Sector",
    payment: "Payment",
    quality: "Quality",
    feedback: "Feedback",
    // LearningView
    learningTitle: "Learning",
    noLearnAgent: "No learning data for this agent",
    memoryEntries: "Memory entries",
    // Artifacts
    artifactsTitle: "Artifacts",
    noArtifacts: "No artifacts found",
    // AgentDetail
    agentDetail: "Agent Detail",
    loading: "Loading...",
    // General
    secondsAgo: (s) => `${s}s ago`,
    ago: "ago",
    hoursLabel: (h) => `${h}h elapsed`,
    perHour: "/hr",
    perDay: "/day",
    selectHint: "Select an agent to view tasks",
    yes: "Yes",
    no: "No",
    agentsCompeting: (n) => `${n} agent${n !== 1 ? 's' : ''} competing`,
  },
  zh: {
    // Sidebar
    livebench: "LiveBench",
    subtitle: "AI 生存游戏",
    live: "实时",
    connecting: "连接中",
    disconnected: "已断开",
    error: "错误",
    agentVisibility: "智能体可见性",
    noAgentsDiscovered: "未发现智能体",
    apply: "应用",
    leaderboard: "排行榜",
    dashboard: "控制面板",
    artifacts: "产出物",
    workTasks: "工作任务",
    learning: "知识库",
    agents: "智能体",
    noAgentsRunning: "没有运行的智能体",
    starOnGitHub: "在 GitHub 上点赞",
    squidGame: "AI 版的鱿鱼游戏",
    // Leaderboard
    failedToLoad: "加载排行榜失败",
    noAgentsFound: "未找到智能体",
    runSomeAgents: "请启动一些智能体以在排行榜上查看它们",
    competing: "参与竞争",
    topPerformer: "最佳表现",
    balanceHistory: "余额走势",
    dataPoints: "个数据点",
    wallClockHrs: "工作时长",
    cumulativeWorkHours: "累计工作小时数",
    rank: "排名",
    agent: "智能体",
    starter: "启动金",
    balance: "余额",
    pctChange: "变动率",
    income: "收入",
    cost: "成本",
    payRate: "时薪",
    avgQuality: "平均质量",
    tasks: "任务数",
    status: "状态",
    retry: "重试",
    // Dashboard
    noAgentSelected: "未选择智能体",
    selectAgentFromSidebar: "请从侧边栏选择一个智能体以查看详情",
    agentDashboard: "智能体看板 - 实时监控",
    starterAsset: "启动资产",
    netWorth: "净资产",
    totalTokenCost: "总 Token 成本",
    workIncome: "工作收入",
    avgQualityScore: "平均质量分",
    wallClockTime: "实际耗时",
    currentlyActive: "当前活动",
    date: "日期",
    balanceHistoryTitle: "余额走势",
    domainEarnings: "领域收益",
    earned: "已赚取",
    failedWasted: "失败浪费",
    untappedPotential: "未开发潜力",
    noTaskDataYet: "暂无任务数据",
    recentDecisions: "最近决策",
    // WorkView
    workTasksTitle: "工作任务",
    noTasksAgent: "该智能体暂无任务",
    selectAgent: "请选择一个智能体查看任务",
    allSectors: "所有行业",
    completed: "已完成",
    task: "任务",
    occupation: "职业",
    sector: "行业",
    payment: "报酬",
    quality: "质量",
    feedback: "反馈",
    // LearningView
    learningTitle: "知识库",
    noLearnAgent: "该智能体暂无学习记录",
    memoryEntries: "条记忆",
    // Artifacts
    artifactsTitle: "产出物",
    noArtifacts: "暂无产出物",
    // AgentDetail
    agentDetail: "智能体详情",
    loading: "加载中...",
    // General
    secondsAgo: (s) => `${s}秒前`,
    ago: "前",
    hoursLabel: (h) => `已过 ${h} 小时`,
    perHour: "/小时",
    perDay: "/天",
    selectHint: "请选择一个智能体查看任务",
    yes: "是",
    no: "否",
    agentsCompeting: (n) => `${n} 个智能体参与竞争`,
  },
}

const LangContext = createContext(null)

function getInitialLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en'
  } catch { return 'en' }
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
  }, [lang])

  const t = (key, ...args) => {
    const val = LOCALES[lang]?.[key]
    if (typeof val === 'function') return val(...args)
    return val ?? LOCALES.en[key] ?? key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LangContext)
}