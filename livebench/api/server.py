"""
LiveBench API Server - Real-time updates and data access for frontend

This FastAPI server provides:
- WebSocket endpoint for live agent activity streaming
- REST endpoints for agent data, tasks, and economic metrics
- Real-time updates as agents work and learn
"""

import os

# Unified environment key mapping
if "DEEPSEEK_API_KEY" in os.environ and "EVALUATION_API_KEY" not in os.environ:
    os.environ["EVALUATION_API_KEY"] = os.environ["DEEPSEEK_API_KEY"]

import json
import asyncio
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import glob

app = FastAPI(title="LiveBench API", version="1.0.2")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data path
DATA_PATH = Path(__file__).parent.parent / "data" / "agent_data"
HIDDEN_AGENTS_PATH = Path(__file__).parent.parent / "data" / "hidden_agents.json"

# Task value lookup (task_id -> task_value_usd)
_TASK_VALUES_PATH = Path(__file__).parent.parent.parent / "scripts" / "task_value_estimates" / "task_values.jsonl"


def _load_task_values() -> tuple:
    values = {}
    pool = {}
    if not _TASK_VALUES_PATH.exists():
        return values, pool
    with open(_TASK_VALUES_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                tid = entry.get("task_id")
                val = entry.get("task_value_usd")
                if tid and val is not None:
                    values[tid] = val
                    pool[tid] = {
                        "task_value_usd": val,
                        "occupation": entry.get("occupation", "Unknown"),
                        "sector": entry.get("sector", "Unknown"),
                    }
            except json.JSONDecodeError:
                pass
    return values, pool


TASK_VALUES, TASK_POOL = _load_task_values()


def _load_task_completions_by_task_id(agent_dir: Path) -> dict:
    """Load task_completions.jsonl indexed by task_id → entry dict."""
    completions_file = agent_dir / "economic" / "task_completions.jsonl"
    by_task_id = {}
    if not completions_file.exists():
        return by_task_id
    with open(completions_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                tid = entry.get("task_id")
                if tid:
                    by_task_id[tid] = entry
            except json.JSONDecodeError:
                pass
    return by_task_id


def _load_task_completions_by_date(agent_dir: Path) -> dict:
    """Load task_completions.jsonl, summing wall_clock_seconds per date."""
    completions_file = agent_dir / "economic" / "task_completions.jsonl"
    by_date: dict = {}
    if not completions_file.exists():
        return by_date
    with open(completions_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                date = entry.get("date")
                secs = entry.get("wall_clock_seconds")
                if date and secs is not None:
                    by_date[date] = by_date.get(date, 0.0) + float(secs)
            except json.JSONDecodeError:
                pass
    return by_date


# Active WebSocket connections
active_connections: List[WebSocket] = []


class AgentStatus(BaseModel):
    """Agent status model"""
    signature: str
    balance: float
    net_worth: float
    survival_status: str
    current_activity: Optional[str] = None
    current_date: Optional[str] = None


class WorkTask(BaseModel):
    """Work task model"""
    task_id: str
    sector: str
    occupation: str
    prompt: str
    date: str
    status: str = "assigned"


class LearningEntry(BaseModel):
    """Learning memory entry"""
    topic: str
    content: str
    timestamp: str


class EconomicMetrics(BaseModel):
    """Economic metrics model"""
    balance: float
    total_token_cost: float
    total_work_income: float
    net_worth: float
    dates: List[str]
    balance_history: List[float]


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


manager = ConnectionManager()


# SPA fallback — placed after all API/WS routes are defined at the bottom of this file.
# See FRONTEND_MOUNT at the end.


@app.get("/api/agents")
async def get_agents():
    """Get list of all agents with their current status"""
    agents = []

    if not DATA_PATH.exists():
        return {"agents": []}

    for agent_dir in DATA_PATH.iterdir():
        if agent_dir.is_dir():
            signature = agent_dir.name

            # Get latest balance
            balance_file = agent_dir / "economic" / "balance.jsonl"
            balance_data = None
            if balance_file.exists():
                with open(balance_file, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        balance_data = json.loads(lines[-1])

            # Get latest decision
            decision_file = agent_dir / "decisions" / "decisions.jsonl"
            current_activity = None
            current_date = None
            if decision_file.exists():
                with open(decision_file, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        decision = json.loads(lines[-1])
                        current_activity = decision.get("activity")
                        current_date = decision.get("date")

            if balance_data:
                agents.append({
                    "signature": signature,
                    "balance": balance_data.get("balance", 0),
                    "net_worth": balance_data.get("net_worth", 0),
                    "survival_status": balance_data.get("survival_status", "unknown"),
                    "current_activity": current_activity,
                    "current_date": current_date,
                    "total_token_cost": balance_data.get("total_token_cost", 0)
                })

    return {"agents": agents}


@app.get("/api/agents/{signature}")
async def get_agent_details(signature: str):
    """Get detailed information about a specific agent"""
    agent_dir = DATA_PATH / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get balance history
    balance_file = agent_dir / "economic" / "balance.jsonl"
    balance_history = []
    if balance_file.exists():
        with open(balance_file, 'r') as f:
            for line in f:
                balance_history.append(json.loads(line))

    # Get decisions
    decision_file = agent_dir / "decisions" / "decisions.jsonl"
    decisions = []
    if decision_file.exists():
        with open(decision_file, 'r') as f:
            for line in f:
                decisions.append(json.loads(line))

    # Get evaluation statistics — use task_completions.jsonl for authoritative task count
    evaluations_file = agent_dir / "work" / "evaluations.jsonl"
    avg_evaluation_score = None
    evaluation_scores = []

    if evaluations_file.exists():
        with open(evaluations_file, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                eval_data = json.loads(line)
                score = eval_data.get("evaluation_score")
                if score is not None:
                    evaluation_scores.append(score)

        if evaluation_scores:
            avg_evaluation_score = sum(evaluation_scores) / len(evaluation_scores)

    # Authoritative task count from task_completions.jsonl
    num_tasks = len(_load_task_completions_by_task_id(agent_dir))

    # Get latest status
    latest_balance = balance_history[-1] if balance_history else {}
    latest_decision = decisions[-1] if decisions else {}

    return {
        "signature": signature,
        "current_status": {
            "balance": latest_balance.get("balance", 0),
            "net_worth": latest_balance.get("net_worth", 0),
            "survival_status": latest_balance.get("survival_status", "unknown"),
            "total_token_cost": latest_balance.get("total_token_cost", 0),
            "total_work_income": latest_balance.get("total_work_income", 0),
            "current_activity": latest_decision.get("activity"),
            "current_date": latest_decision.get("date"),
            "avg_evaluation_score": avg_evaluation_score,
            "num_evaluations": num_tasks  # authoritative count from task_completions.jsonl
        },
        "balance_history": balance_history,
        "decisions": decisions,
        "evaluation_scores": evaluation_scores
    }


@app.get("/api/agents/{signature}/tasks")
async def get_agent_tasks(signature: str):
    """Get all tasks assigned to an agent.

    Uses task_completions.jsonl as the authoritative list of tasks (no duplicates).
    task_details are looked up from tasks.jsonl (first occurrence per task_id).
    """
    agent_dir = DATA_PATH / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    tasks_file = agent_dir / "work" / "tasks.jsonl"
    evaluations_file = agent_dir / "work" / "evaluations.jsonl"
    completions_file = agent_dir / "economic" / "task_completions.jsonl"

    # Build task metadata lookup from tasks.jsonl (first occurrence per task_id)
    task_metadata: dict = {}
    if tasks_file.exists():
        with open(tasks_file, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                entry = json.loads(line)
                tid = entry.get("task_id")
                if tid and tid not in task_metadata:
                    task_metadata[tid] = entry

    # Build evaluations lookup (by task_id)
    evaluations: dict = {}
    if evaluations_file.exists():
        with open(evaluations_file, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                eval_data = json.loads(line)
                tid = eval_data.get("task_id")
                if tid:
                    evaluations[tid] = eval_data

    # Build task list from task_completions.jsonl (authoritative — one entry per task, no duplicates)
    tasks = []
    seen_ids = set()
    
    if completions_file.exists():
        with open(completions_file, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                completion = json.loads(line)
                tid = completion.get("task_id")
                if not tid or tid in seen_ids:
                    continue
                seen_ids.add(tid)

                # Merge task metadata from tasks.jsonl
                task = dict(task_metadata.get(tid, {}))
                task["task_id"] = tid
                # Use date from task_completions (reflects actual execution date)
                task["date"] = completion.get("date", task.get("date", ""))

                # Wall-clock time (authoritative source)
                task["wall_clock_seconds"] = completion.get("wall_clock_seconds")

                # Task market value
                if tid in TASK_VALUES:
                    task["task_value_usd"] = TASK_VALUES[tid]

                # Merge evaluation data
                if tid in evaluations:
                    task["evaluation"] = evaluations[tid]
                    task["completed"] = True
                    task["payment"] = evaluations[tid].get("payment", 0)
                    task["feedback"] = evaluations[tid].get("feedback", "")
                    task["evaluation_score"] = evaluations[tid].get("evaluation_score", None)
                    task["evaluation_method"] = evaluations[tid].get("evaluation_method", "heuristic")
                else:
                    task["completed"] = bool(completion.get("work_submitted", False))
                    task["payment"] = completion.get("money_earned", 0)
                    task["evaluation_score"] = completion.get("evaluation_score")
                    task["evaluation_method"] = "heuristic"

                tasks.append(task)

    # Also add pending/running tasks from tasks.jsonl that haven't finished yet
    if tasks_file.exists():
        with open(tasks_file, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                entry = json.loads(line)
                tid = entry.get("task_id")
                if not tid or tid in seen_ids:
                    continue
                seen_ids.add(tid)
                # This task hasn't completed yet — show as pending
                task = dict(entry)
                task["completed"] = False
                task["payment"] = 0
                task["evaluation_score"] = None
                tasks.append(task)

    # Pool size = total tasks available in GDPVal (all 220), sourced from TASK_VALUES
    pool_size = len(TASK_VALUES) if TASK_VALUES else None

    # Add unassigned tasks from the full GDPVal pool so the dashboard can show
    # untapped potential from tasks the agent never attempted.
    assigned_ids = {t["task_id"] for t in tasks}
    for tid, meta in TASK_POOL.items():
        if tid not in assigned_ids:
            tasks.append({
                "task_id": tid,
                "occupation": meta["occupation"],
                "sector": meta["sector"],
                "task_value_usd": meta["task_value_usd"],
                "completed": False,
                "payment": 0,
                "evaluation_score": None,
            })

    return {"tasks": tasks, "pool_size": pool_size}


# ── Terminal Log endpoints ──────────────────────────────────────────────────


@app.get("/api/agents/{signature}/terminal-log/{date}")
async def get_terminal_log(signature: str, date: str):
    """Get terminal log for an agent on a specific date"""
    agent_dir = DATA_PATH / signature
    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")
    # First try: consolidated terminal.log in work/ (from subprocess redirection)
    terminal_log = agent_dir / "work" / "terminal.log"
    if terminal_log.exists():
        content = terminal_log.read_text(encoding="utf-8", errors="replace")
        return {"date": date, "content": content}
    # Fallback: legacy per-date logs in terminal_logs/
    log_file = agent_dir / "terminal_logs" / f"{date}.log"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="Log not found")
    content = log_file.read_text(encoding="utf-8", errors="replace")
    return {"date": date, "content": content}


@app.get("/api/agents/{signature}/terminal-log")
async def get_terminal_log_latest(signature: str):
    """Get the latest terminal log for an agent (from work/terminal.log)"""
    agent_dir = DATA_PATH / signature
    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")
    terminal_log = agent_dir / "work" / "terminal.log"
    if not terminal_log.exists():
        raise HTTPException(status_code=404, detail="No terminal log found. The agent may not have started yet.")
    content = terminal_log.read_text(encoding="utf-8", errors="replace")
    return {"date": "latest", "content": content}


@app.get("/api/agents/{signature}/learning")
async def get_agent_learning(signature: str):
    """Get agent's learning memory"""
    agent_dir = DATA_PATH / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    memory_file = agent_dir / "memory" / "memory.jsonl"

    if not memory_file.exists():
        return {"memory": "", "entries": []}

    # Parse JSONL format
    entries = []
    with open(memory_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                entry = json.loads(line)
                entries.append({
                    "topic": entry.get("topic", "Unknown"),
                    "timestamp": entry.get("timestamp", ""),
                    "date": entry.get("date", ""),
                    "content": entry.get("knowledge", "")
                })

    # Create a summary memory content
    memory_content = "\n\n".join([
        f"## {entry['topic']} ({entry['date']})\n{entry['content']}"
        for entry in entries
    ])

    return {
        "memory": memory_content,
        "entries": entries
    }


@app.get("/api/agents/{signature}/economic")
async def get_agent_economic(signature: str):
    """Get economic metrics for an agent"""
    agent_dir = DATA_PATH / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    balance_file = agent_dir / "economic" / "balance.jsonl"

    if not balance_file.exists():
        raise HTTPException(status_code=404, detail="No economic data found")

    dates = []
    balance_history = []
    token_costs = []
    work_income = []

    with open(balance_file, 'r') as f:
        for line in f:
            data = json.loads(line)
            dates.append(data.get("date", ""))
            balance_history.append(data.get("balance", 0))
            token_costs.append(data.get("daily_token_cost", 0))
            work_income.append(data.get("work_income_delta", 0))

    latest = json.loads(line) if line else {}

    return {
        "balance": latest.get("balance", 0),
        "total_token_cost": latest.get("total_token_cost", 0),
        "total_work_income": latest.get("total_work_income", 0),
        "net_worth": latest.get("net_worth", 0),
        "survival_status": latest.get("survival_status", "unknown"),
        "dates": dates,
        "balance_history": balance_history,
        "token_costs": token_costs,
        "work_income": work_income
    }


@app.get("/api/leaderboard")
async def get_leaderboard():
    """Get leaderboard data for all agents with summary metrics and balance histories"""
    if not DATA_PATH.exists():
        return {"agents": []}

    agents = []

    for agent_dir in DATA_PATH.iterdir():
        if not agent_dir.is_dir():
            continue

        signature = agent_dir.name

        # Load balance history
        balance_file = agent_dir / "economic" / "balance.jsonl"
        balance_history = []
        if balance_file.exists():
            with open(balance_file, 'r') as f:
                for line in f:
                    if line.strip():
                        balance_history.append(json.loads(line))

        if not balance_history:
            continue

        latest = balance_history[-1]
        initial_balance = balance_history[0].get("balance", 0)
        current_balance = latest.get("balance", 0)
        pct_change = ((current_balance - initial_balance) / initial_balance * 100) if initial_balance else 0

        # Load evaluation scores
        evaluations_file = agent_dir / "work" / "evaluations.jsonl"
        evaluation_scores = []
        if evaluations_file.exists():
            with open(evaluations_file, 'r') as f:
                for line in f:
                    if line.strip():
                        eval_data = json.loads(line)
                        score = eval_data.get("evaluation_score")
                        if score is not None:
                            evaluation_scores.append(score)

        avg_eval_score = (sum(evaluation_scores) / len(evaluation_scores)) if evaluation_scores else None

        # Load task completions (authoritative source) — used for wall-clock and task count
        task_completions_by_task_id = _load_task_completions_by_task_id(agent_dir)
        task_completions_by_date = _load_task_completions_by_date(agent_dir)

        # Strip balance history to essential fields, exclude initialization
        stripped_history = []
        for entry in balance_history:
            if entry.get("date") == "initialization":
                continue
            stripped_history.append({
                "date": entry.get("date"),
                "balance": entry.get("balance", 0),
            })

        # Build wall-clock series from task_completions (every entry has wall_clock_seconds).
        # We pair each completion with the balance recorded in balance.jsonl for that task_id.
        balance_by_task_id = {}
        for entry in balance_history:
            tid = entry.get("task_id")
            if tid:
                balance_by_task_id[tid] = entry.get("balance", 0)

        # Sort completions by timestamp so cumulative hours are in execution order
        sorted_completions = sorted(
            task_completions_by_task_id.values(),
            key=lambda e: e.get("timestamp") or "",
        )
        wc_series = []
        for tc in sorted_completions:
            tid = tc.get("task_id")
            wcs = tc.get("wall_clock_seconds")
            if wcs is None:
                continue
            wc_series.append({
                "wall_clock_seconds": wcs,
                "balance": balance_by_task_id.get(tid, current_balance),
                "date": tc.get("date"),
                "timestamp": tc.get("timestamp"),
            })

        agents.append({
            "signature": signature,
            "initial_balance": initial_balance,
            "current_balance": current_balance,
            "pct_change": round(pct_change, 1),
            "total_token_cost": latest.get("total_token_cost", 0),
            "total_work_income": latest.get("total_work_income", 0),
            "net_worth": latest.get("net_worth", 0),
            "survival_status": latest.get("survival_status", "unknown"),
            "num_tasks": len(task_completions_by_task_id),  # authoritative count from task_completions.jsonl
            "avg_eval_score": avg_eval_score,
            "balance_history": stripped_history,
            "wc_series": wc_series,
        })

    # Sort by current_balance descending
    agents.sort(key=lambda a: a["current_balance"], reverse=True)

    return {"agents": agents}


ARTIFACT_EXTENSIONS = {'.pdf', '.docx', '.xlsx', '.pptx'}
ARTIFACT_MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}


@app.get("/api/artifacts/random")
async def get_random_artifacts(count: int = Query(default=30, ge=1, le=100)):
    """Get a random sample of agent-produced artifact files"""
    if not DATA_PATH.exists():
        return {"artifacts": []}

    artifacts = []
    for agent_dir in DATA_PATH.iterdir():
        if not agent_dir.is_dir():
            continue
        sandbox_dir = agent_dir / "sandbox"
        if not sandbox_dir.exists():
            continue
        signature = agent_dir.name
        for date_dir in sandbox_dir.iterdir():
            if not date_dir.is_dir():
                continue
            for file_path in date_dir.rglob("*"):
                if not file_path.is_file():
                    continue
                # Skip code_exec, videos, and reference_files directories
                rel_parts = file_path.relative_to(date_dir).parts
                if any(p in ('code_exec', 'videos', 'reference_files') for p in rel_parts):
                    continue
                ext = file_path.suffix.lower()
                if ext not in ARTIFACT_EXTENSIONS:
                    continue
                rel_path = str(file_path.relative_to(DATA_PATH))
                artifacts.append({
                    "agent": signature,
                    "date": date_dir.name,
                    "filename": file_path.name,
                    "extension": ext,
                    "size_bytes": file_path.stat().st_size,
                    "path": rel_path,
                })

    if len(artifacts) > count:
        artifacts = random.sample(artifacts, count)

    return {"artifacts": artifacts}


@app.get("/api/artifacts/file")
async def get_artifact_file(path: str = Query(...)):
    """Serve an artifact file for preview/download"""
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")

    file_path = (DATA_PATH / path).resolve()
    # Ensure resolved path is within DATA_PATH
    if not str(file_path).startswith(str(DATA_PATH.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    ext = file_path.suffix.lower()
    media_type = ARTIFACT_MIME_TYPES.get(ext, 'application/octet-stream')
    return FileResponse(file_path, media_type=media_type)


@app.get("/api/settings/hidden-agents")
async def get_hidden_agents():
    """Get list of hidden agent signatures"""
    if HIDDEN_AGENTS_PATH.exists():
        with open(HIDDEN_AGENTS_PATH, 'r') as f:
            hidden = json.load(f)
        return {"hidden": hidden}
    return {"hidden": []}


@app.put("/api/settings/hidden-agents")
async def set_hidden_agents(body: dict):
    """Set list of hidden agent signatures"""
    hidden = body.get("hidden", [])
    HIDDEN_AGENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HIDDEN_AGENTS_PATH, 'w') as f:
        json.dump(hidden, f)
    return {"status": "ok"}


DISPLAYING_NAMES_PATH = Path(__file__).parent.parent / "data" / "displaying_names.json"

@app.get("/api/settings/displaying-names")
async def get_displaying_names():
    """Get display name mapping {signature: display_name}"""
    if DISPLAYING_NAMES_PATH.exists():
        with open(DISPLAYING_NAMES_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to LiveBench real-time updates"
        })

        # Keep connection alive with 10s ping heartbeat and listen for messages
        async def heartbeat():
            while True:
                await asyncio.sleep(10)
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

        heartbeat_task = asyncio.create_task(heartbeat())

        try:
            while True:
                data = await websocket.receive_text()
                await websocket.send_json({
                    "type": "echo",
                    "data": data
                })
        finally:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/api/broadcast")
async def broadcast_message(message: dict):
    """
    Endpoint for LiveBench to broadcast updates to connected clients
    This should be called by the LiveAgent during execution
    """
    await manager.broadcast(message)
    return {"status": "broadcast sent"}


# File watcher for live updates (optional, for when agents are running)
async def watch_agent_files():
    """
    Watch agent data files for changes and broadcast updates
    This runs as a background task
    """
    import time
    last_modified = {}

    while True:
        try:
            if DATA_PATH.exists():
                for agent_dir in DATA_PATH.iterdir():
                    if agent_dir.is_dir():
                        signature = agent_dir.name

                        # Check balance file
                        balance_file = agent_dir / "economic" / "balance.jsonl"
                        if balance_file.exists():
                            mtime = balance_file.stat().st_mtime
                            key = f"{signature}_balance"

                            if key not in last_modified or mtime > last_modified[key]:
                                last_modified[key] = mtime

                                # Read latest balance
                                with open(balance_file, 'r') as f:
                                    lines = f.readlines()
                                    if lines:
                                        data = json.loads(lines[-1])
                                        await manager.broadcast({
                                            "type": "balance_update",
                                            "signature": signature,
                                            "data": data
                                        })

                        # Check decisions file
                        decision_file = agent_dir / "decisions" / "decisions.jsonl"
                        if decision_file.exists():
                            mtime = decision_file.stat().st_mtime
                            key = f"{signature}_decision"

                            if key not in last_modified or mtime > last_modified[key]:
                                last_modified[key] = mtime

                                # Read latest decision
                                with open(decision_file, 'r') as f:
                                    lines = f.readlines()
                                    if lines:
                                        data = json.loads(lines[-1])
                                        await manager.broadcast({
                                            "type": "activity_update",
                                            "signature": signature,
                                            "data": data
                                        })
        except Exception as e:
            print(f"Error watching files: {e}")

        await asyncio.sleep(1)  # Check every second


@app.on_event("startup")
async def startup_event():
    """Start background tasks on startup"""
    asyncio.create_task(watch_agent_files())


# SPA catch-all: Use simple routes instead of StaticFiles mount to avoid
# interfering with WebSocket upgrade requests in cloud proxy environments.
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    from fastapi.responses import HTMLResponse
    import mimetypes

    @app.get("/assets/{file_path:path}", include_in_schema=False)
    async def serve_assets(file_path: str):
        """Serve frontend static assets (JS, CSS, images, etc.)"""
        asset_path = FRONTEND_DIST / "assets" / file_path
        if asset_path.exists() and asset_path.is_file():
            media_type, _ = mimetypes.guess_type(str(asset_path))
            return FileResponse(str(asset_path), media_type=media_type or "application/octet-stream")
        return HTMLResponse(content="Not found", status_code=404)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve the SPA index.html for any unmatched path (catch-all after API/WS routes)."""
        index_path = FRONTEND_DIST / "index.html"
        if index_path.exists():
            return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
        return HTMLResponse(content="Frontend not found", status_code=404)

# ── Dynamic Task Submission API ─────────────────────────────────────────────
import subprocess
import threading
import tempfile
import uuid


def _fill_config_stubs(config: dict) -> dict:
    """
    Fill in any missing fields in the config dict with safe default stubs,
    so livebench.main's LiveAgent initialization doesn't crash on KeyError.
    """
    lb = config.setdefault("livebench", {})
    lb.setdefault("date_range", {
        "init_date": datetime.now().strftime("%Y-%m-%d"),
        "end_date": datetime.now().strftime("%Y-%m-%d")
    })
    econ = lb.setdefault("economic", {})
    econ.setdefault("initial_balance", 1000.0)
    econ.setdefault("token_pricing", {"input_per_1m": 2.5, "output_per_1m": 10.0})
    econ.setdefault("max_work_payment", 50.0)
    lb.setdefault("agent_params", {
        "max_steps": 20,
        "max_retries": 3,
        "base_delay": 0.5,
        "tasks_per_day": 1
    })
    lb.setdefault("evaluation", {
        "use_llm_evaluation": True,
        "meta_prompts_dir": "./eval/meta_prompts"
    })
    lb.setdefault("data_path", "./livebench/data/agent_data")
    # Ensure agents list has at least one enabled entry
    if "agents" not in lb or not lb["agents"]:
        lb["agents"] = [{
            "signature": "default-agent",
            "basemodel": "deepseek-chat",
            "enabled": True,
            "tasks_per_day": 1,
            "supports_multimodal": False,
        }]
    # Ensure tasks in task_source are properly formed
    ts = lb.setdefault("task_source", {})
    ts.setdefault("type", "inline")
    if ts.get("type") == "inline" and "tasks" in ts:
        for t in ts["tasks"]:
            t.setdefault("sector", "Custom Task")
            t.setdefault("occupation", "Software Development")
            t.setdefault("status", "pending")
    return config


@app.post("/api/tasks/submit")
async def submit_task(body: dict):
    """
    Submit a real-world task for AI agents to execute.
    Dynamically creates a temporary config and launches agents in background.
    
    Request body:
    {
        "task_description": "Build a Python CLI tool that...",
        "agent_model": "deepseek-chat",           # optional, default deepseek-chat
        "agent_signature": "custom-agent",         # optional
        "max_steps": 20,                           # optional
    }
    """
    task_desc = body.get("task_description", "").strip()
    if not task_desc:
        raise HTTPException(status_code=400, detail="task_description is required")
    
    agent_model = body.get("agent_model", "deepseek-chat")
    agent_sig = body.get("agent_signature", f"custom-{uuid.uuid4().hex[:8]}")
    max_steps = body.get("max_steps", 20)
    
    # Generate a unique inline task ID
    task_id = uuid.uuid4().hex[:12]
    
    # Create a temporary config file for this task
    config = {
        "livebench": {
            "date_range": {
                "init_date": datetime.now().strftime("%Y-%m-%d"),
                "end_date": datetime.now().strftime("%Y-%m-%d")
            },
            "economic": {
                "initial_balance": 1000.0,
                "task_values_path": "./scripts/task_value_estimates/task_values.jsonl",
                "token_pricing": {
                    "input_per_1m": 2.5,
                    "output_per_1m": 10.0
                }
            },
            "agents": [
                {
                    "signature": agent_sig,
                    "basemodel": agent_model,
                    "enabled": True,
                    "tasks_per_day": 1,
                    "supports_multimodal": False
                }
            ],
            "agent_params": {
                "max_steps": max_steps,
                "max_retries": 3,
                "base_delay": 0.5,
                "tasks_per_day": 1
            },
            "evaluation": {
                "use_llm_evaluation": True,
                "meta_prompts_dir": "./eval/meta_prompts"
            },
            "data_path": "./livebench/data/agent_data",
            "task_source": {
                "type": "inline",
                "tasks": [
                    {
                        "task_id": task_id,
                        "date": datetime.now().strftime("%Y-%m-%d"),
                        "sector": "Custom Task",
                        "occupation": "Software Development",
                        "prompt": task_desc,
                        "status": "pending"
                    }
                ]
            }
        }
    }
    
    # Apply stub-fill for safety (in case any fields were omitted)
    config = _fill_config_stubs(config)
    
    # Write config to temp file
    config_dir = os.path.join(os.path.dirname(__file__), "..", "..", "temp_configs")
    os.makedirs(config_dir, exist_ok=True)
    config_path = os.path.join(config_dir, f"task_{task_id}.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    
    # ── IMMEDIATELY create agent data dir so the agent appears in sidebar ──
    agent_data_dir = os.path.join(os.path.dirname(__file__), "..", "..", "livebench", "data", "agent_data", agent_sig)
    os.makedirs(os.path.join(agent_data_dir, "economic"), exist_ok=True)
    os.makedirs(os.path.join(agent_data_dir, "work"), exist_ok=True)
    os.makedirs(os.path.join(agent_data_dir, "decisions"), exist_ok=True)
    os.makedirs(os.path.join(agent_data_dir, "memory"), exist_ok=True)
    
    # Write initialization balance record so the agent shows up in GET /api/agents
    init_balance = {
        "date": "initialization",
        "balance": 1000.0,
        "net_worth": 1000.0,
        "survival_status": "active",
        "total_token_cost": 0.0,
        "total_work_income": 0.0,
        "daily_token_cost": 0.0,
        "work_income_delta": 0.0,
    }
    with open(os.path.join(agent_data_dir, "economic", "balance.jsonl"), "w") as f:
        f.write(json.dumps(init_balance) + "\n")
    
    # Write the task into tasks.jsonl so it shows in the Work Tasks page immediately
    task_record = {
        "task_id": task_id,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "agent_signature": agent_sig,
        "sector": "Custom Task",
        "occupation": "Software Development",
        "prompt": task_desc,
        "status": "running",
    }
    with open(os.path.join(agent_data_dir, "work", "tasks.jsonl"), "w") as f:
        f.write(json.dumps(task_record) + "\n")
    
    # Write a hint decision so dashboard shows "working"
    decision_record = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "activity": "work",
        "reasoning": f"Custom task submitted via web: {task_desc[:80]}...",
        "timestamp": datetime.now().isoformat(),
    }
    with open(os.path.join(agent_data_dir, "decisions", "decisions.jsonl"), "w") as f:
        f.write(json.dumps(decision_record) + "\n")
    
    # ── Sidecar: track all submitted tasks for global pending-task view ──
    sidecar_dir = os.path.join(os.path.dirname(__file__), "..", "..", "livebench", "data")
    os.makedirs(sidecar_dir, exist_ok=True)
    with open(os.path.join(sidecar_dir, "submitted_tasks.jsonl"), "a") as f:
        f.write(json.dumps({
            "task_id": task_id,
            "agent_signature": agent_sig,
            "agent_model": agent_model,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "task_description": task_desc,
            "status": "pending",
        }) + "\n")
    
    # ── Launch agent in background thread with log redirection ──
    def run_agent():
        import sys
        project_root = os.path.join(os.path.dirname(__file__), "..", "..")
        env = os.environ.copy()
        if "DEEPSEEK_API_KEY" in env and "OPENAI_API_KEY" not in env:
            env["OPENAI_API_KEY"] = env["DEEPSEEK_API_KEY"]
        if "DEEPSEEK_API_BASE" in env and "OPENAI_API_BASE" not in env:
            env["OPENAI_API_BASE"] = env["DEEPSEEK_API_BASE"]
        env["PYTHONPATH"] = f"{project_root}{os.pathsep}{env.get('PYTHONPATH', '')}"
        cmd = [sys.executable, "-m", "livebench.main", config_path, "--exhaust"]
        
        # Redirect subprocess stdout/stderr to work/terminal.log for real-time visibility
        terminal_log_path = os.path.join(agent_data_dir, "work", "terminal.log")
        try:
            with open(terminal_log_path, "w", encoding="utf-8") as log_f:
                log_f.write(f"[{datetime.now().isoformat()}] Task {task_id} starting: {task_desc[:120]}...\n")
                log_f.write(f"[{datetime.now().isoformat()}] Command: {' '.join(cmd)}\n")
                log_f.write(f"[{datetime.now().isoformat()}] CWD: {project_root}\n")
                log_f.write(f"[{datetime.now().isoformat()}] Agent: {agent_sig} | Model: {agent_model} | Max steps: {max_steps}\n")
                log_f.flush()
                
                proc = subprocess.Popen(
                    cmd,
                    cwd=project_root,
                    env=env,
                    stdout=log_f,
                    stderr=log_f,
                    text=True,
                )
                
                # Wait for process with timeout
                try:
                    exit_code = proc.wait(timeout=3600)
                    log_f.write(f"\n[{datetime.now().isoformat()}] Task {task_id} exit_code={exit_code}\n")
                    log_f.flush()
                    _update_task_status(agent_data_dir, task_id,
                        "completed" if exit_code == 0 else "failed",
                        f"exit_code={exit_code}")
                except subprocess.TimeoutExpired:
                    proc.kill()
                    log_f.write(f"\n[{datetime.now().isoformat()}] Task {task_id} TIMED OUT after 1 hour\n")
                    log_f.flush()
                    _update_task_status(agent_data_dir, task_id, "failed", "timeout")
                    
        except Exception as e:
            import traceback
            error_msg = f"[{datetime.now().isoformat()}] Task {task_id} error: {e}\n{traceback.format_exc()}"
            print(error_msg)
            try:
                with open(terminal_log_path, "a", encoding="utf-8") as log_f:
                    log_f.write(error_msg + "\n")
            except Exception:
                pass
            _update_task_status(agent_data_dir, task_id, "failed", str(e))
    
    thread = threading.Thread(target=run_agent, daemon=True)
    thread.start()
    
    return {
        "status": "accepted",
        "task_id": task_id,
        "agent_signature": agent_sig,
        "agent_model": agent_model,
        "message": f"Task submitted. Agent '{agent_sig}' ({agent_model}) is now working on it.",
        "hint": f"Select agent '{agent_sig}' from the sidebar and refresh to track progress."
    }


def _update_task_status(agent_data_dir: str, task_id: str, status: str, reason: str = ""):
    """Update the status of a submitted task in tasks.jsonl."""
    tasks_file_path = os.path.join(agent_data_dir, "work", "tasks.jsonl")
    if not os.path.exists(tasks_file_path):
        return
    lines = []
    with open(tasks_file_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("task_id") == task_id:
                entry["status"] = status
                if reason:
                    entry["status_reason"] = reason
            lines.append(json.dumps(entry))
    with open(tasks_file_path, "w") as f:
        for line in lines:
            f.write(line + "\n")


@app.get("/api/tasks/status")
async def get_submitted_tasks_status():
    """Get status of all custom-submitted tasks."""
    sidecar_path = os.path.join(os.path.dirname(__file__), "..", "..", "livebench", "data", "submitted_tasks.jsonl")
    if not os.path.exists(sidecar_path):
        return {"tasks": []}
    tasks = []
    with open(sidecar_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            tasks.append(json.loads(line))
    return {"tasks": tasks}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)