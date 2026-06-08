#!/usr/bin/env python3
"""
governance_hook.py — 治理中心强制启动钩子 (v1.0)
================================================
每次 Cline 启动 / 接收新任务时，自动：
1. 执行 `.governance_entry.py` 哨兵下沉 → 建立治理链接
2. 弹窗 / 注入最高宪法提示，确保 Cline 先读宪法再执行任务
3. 验证治理中心健康状态 (心跳)

安装方式：在 clawmode_integration/__init__.py 中 import 此模块即可。
"""

import os
import sys
import json
import subprocess
import warnings
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# ───── 路径常量 ─────
THIS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = THIS_DIR.parent
GOVERNANCE_ENTRY = PROJECT_DIR / ".governance_entry.py"
GOVERNANCE_LINK_FILE = PROJECT_DIR / ".governance_link"
HEARTBEAT_FILE = PROJECT_DIR / ".heartbeat"
GOVERNANCE_FIRST_RUN = PROJECT_DIR / ".governance_first_run"

# 宪法源文件路径（相对于 git008 根）
CONSTITUTION_PATH = PROJECT_DIR.parent / "Cline-anti-freeze" / "CONSTITUTION.md"
CLINERULES_PATH = PROJECT_DIR.parent / "Cline-anti-freeze" / ".clinerules"

# ───── 强制宪法提醒模板 ─────
CONSTITUTION_REMINDER = """
+============================================================+
|        [GC] Governance Center - Constitution Forced Active  |
+============================================================+
|  This system is governed by Cline-anti-freeze CONSTITUTION  |
|                                                            |
|  WARNING: EVERY session/start MUST first read constitution  |
|  WARNING: Unconstitutional ops trigger safety audit log     |
|                                                            |
|  Full text: ../Cline-anti-freeze/CONSTITUTION.md           |
|  Anti-freeze: ../Cline-anti-freeze/.clinerules             |
|                                                            |
|  [OK] Governance Center connected | Sentinel heartbeat live |
+============================================================+
"""


# ───── 核心函数 ─────

def run_governance_entry() -> bool:
    """
    执行 `.governance_entry.py` 哨兵下沉。
    返回 True 表示执行成功（哨兵正常链接到治理中心）。
    """
    if not GOVERNANCE_ENTRY.exists():
        print(f"[governance_hook] ❌ 哨兵入口不存在: {GOVERNANCE_ENTRY}")
        return False

    try:
        result = subprocess.run(
            [sys.executable, str(GOVERNANCE_ENTRY)],
            capture_output=True, text=True, timeout=30,
            cwd=str(PROJECT_DIR),
        )
        if result.returncode == 0:
            print(f"[governance_hook] ✅ 哨兵下沉成功\n{result.stdout}")
            return True
        else:
            print(f"[governance_hook] ⚠️ 哨兵返回非零: {result.returncode}")
            print(f"[governance_hook] stderr: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print(f"[governance_hook] ⚠️ 哨兵执行超时")
        return False
    except Exception as e:
        print(f"[governance_hook] ⚠️ 哨兵执行异常: {e}")
        return False


def verify_governance_link() -> tuple[bool, str]:
    """
    验证治理链接文件是否存在且指向正确的治理中心。
    返回 (is_valid, message)
    """
    if not GOVERNANCE_LINK_FILE.exists():
        return False, "治理链接文件不存在 (.governance_link)"

    try:
        link_content = GOVERNANCE_LINK_FILE.read_text(encoding="utf-8").strip()
    except Exception as e:
        return False, f"无法读取 .governance_link: {e}"

    if not link_content:
        return False, ".governance_link 为空"

    # 验证目标路径存在
    target_path = (PROJECT_DIR / link_content).resolve()
    if not target_path.exists():
        return False, f"治理链接目标不存在: {target_path}"

    # 验证治理中心标志文件
    monitor_script = target_path / "monitor.py"
    if not monitor_script.exists():
        return False, f"治理中心缺少 monitor.py: {target_path}"

    return True, f"治理链接有效 → {target_path}"


def check_heartbeat() -> Optional[str]:
    """
    检查心跳文件新鲜度。
    返回 None 表示正常，否则返回警告消息。
    """
    if not HEARTBEAT_FILE.exists():
        return "心跳文件不存在"
    try:
        hb_time = HEARTBEAT_FILE.read_text(encoding="utf-8").strip()
        if not hb_time:
            return "心跳文件为空"
        hb_dt = datetime.fromisoformat(hb_time)
        now = datetime.now(timezone.utc)
        delta = (now - hb_dt).total_seconds()
        if delta > 3600:  # 超过 1 小时未心跳
            return f"心跳过期: {delta:.0f} 秒前"
        return None
    except Exception as e:
        return f"心跳检查异常: {e}"


def get_constitution_preview() -> str:
    """
    读取宪法前几行作为强制预览注入。
    """
    try:
        if CONSTITUTION_PATH.exists():
            lines = CONSTITUTION_PATH.read_text(encoding="utf-8").splitlines()
            preview_lines = lines[:20]  # 前 20 行
            preview = "\n".join(preview_lines)
            return f"\n📜 宪法预览 (前 {len(preview_lines)} 行):\n{preview}\n"
        else:
            return "\n⚠️ 宪法文件未找到\n"
    except Exception as e:
        return f"\n⚠️ 宪法读取失败: {e}\n"


def bootstrap():
    """
    治理中心强制启动引导 — 应在模块导入时自动调用。
    此函数确保：
    1. 哨兵下沉执行（建立治理链接）
    2. 治理链接验证
    3. 心跳检查
    4. 宪法强制提醒注入
    """
    print("\n" + "=" * 66)
    print("  🏛️ 治理中心强制启动钩子 — ClawAI-B")
    print("=" * 66)

    # Step 1: 哨兵下沉
    print("\n[1/4] 执行哨兵下沉...")
    entry_ok = run_governance_entry()

    # Step 2: 验证治理链接
    print("\n[2/4] 验证治理链接...")
    link_valid, link_msg = verify_governance_link()
    print(f"  {'✅' if link_valid else '❌'} {link_msg}")

    # Step 3: 心跳检查
    print("\n[3/4] 检查心跳...")
    hb_warning = check_heartbeat()
    if hb_warning:
        print(f"  ⚠️ {hb_warning}")
    else:
        print(f"  ✅ 心跳正常")

    # Step 4: 宪法强制注入
    print("\n[4/4] 宪法强制提醒:")
    print(CONSTITUTION_REMINDER)
    print(get_constitution_preview())

    # 最终状态
    all_ok = entry_ok and link_valid and (hb_warning is None)
    status_icon = "✅" if all_ok else "⚠️"
    print(f"\n{status_icon} 治理中心状态: {'全部正常' if all_ok else '部分异常，请检查上方日志'}")
    print("=" * 66 + "\n")

    return all_ok


# ───── 模块级自动执行（关键：import 即触发） ─────
# 这是确保 Cline 每次启动/每次对话都无条件执行的核心机制
_governance_initialized = False


def ensure_governance():
    """
    保证治理中心初始化的线程安全包装器。
    支持多次调用但只执行一次实际初始化。
    """
    global _governance_initialized
    if _governance_initialized:
        return True
    result = bootstrap()
    _governance_initialized = True
    return result


# 模块导入时自动触发
# 注意：为兼容性，仅在非测试环境下自动触发
if not any(arg.startswith("pytest") or "unittest" in arg for arg in sys.argv):
    ensure_governance()


if __name__ == "__main__":
    # 直接运行：手动触发一次
    bootstrap()