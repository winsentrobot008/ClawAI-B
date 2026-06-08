"""
ClawMode Integration — ClawWork economic tracking for nanobot.

Extends nanobot's AgentLoop with economic tools so every conversation
is cost-tracked and the agent can check its balance and survival status.

🏛️ 治理集成: 每次模块加载自动触发 governance_hook 哨兵下沉 + 宪法强制提醒。
"""

# ── 🏛️ 治理中心强制钩子（必须先于所有业务模块导入） ──
# 确保 Cline 每次启动 / 接收新任务时无条件执行哨兵下沉 + 宪法阅读提示
from clawmode_integration.governance_hook import ensure_governance
_ = ensure_governance()  # 立即触发治理中心初始化

# ── 业务模块 ──
from clawmode_integration.agent_loop import ClawWorkAgentLoop
from clawmode_integration.task_classifier import TaskClassifier
from clawmode_integration.tools import (
    ClawWorkState,
    DecideActivityTool,
    SubmitWorkTool,
    LearnTool,
    GetStatusTool,
)
from clawmode_integration.artifact_tools import CreateArtifactTool, ReadArtifactTool
from clawmode_integration.provider_wrapper import TrackedProvider

__all__ = [
    "ClawWorkAgentLoop",
    "ClawWorkState",
    "DecideActivityTool",
    "SubmitWorkTool",
    "LearnTool",
    "GetStatusTool",
    "CreateArtifactTool",
    "ReadArtifactTool",
    "TaskClassifier",
    "TrackedProvider",
]
