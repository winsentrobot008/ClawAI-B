"""
Database manager for LiveBench.
- Detects Hugging Face `/data` mount and uses `/data/livebench.db` when available.
- Falls back to `./livebench.db` in project root.
- Provides full CRUD + preview/export/statistics for tasks, agent_logs, artifacts.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

DB_FILENAME = "livebench.db"


# ── Connection helpers ──────────────────────────────────────────────────────


def get_db_path() -> str:
    """Resolve the database file path.

    Priority:
      1. /data/livebench.db (HuggingFace Space mount)
      2. <repo-root>/livebench.db
    """
    if os.path.isdir("/data"):
        return os.path.join("/data", DB_FILENAME)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    return os.path.join(repo_root, DB_FILENAME)


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Open (or create) a connection to the SQLite database.

    Returns a connection with ``row_factory = sqlite3.Row`` so that
    rows can be accessed both by index and by column name.
    """
    path = db_path or get_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def close_connection(conn: sqlite3.Connection) -> None:
    """Close a database connection gracefully."""
    try:
        conn.close()
    except Exception:
        pass


# ── Schema initialisation ───────────────────────────────────────────────────


def initialize_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Create all required tables if they do not exist yet.

    Returns the connection so callers can immediately use it.
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    # ── tasks ────────────────────────────────────────────────────────────
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tasks (
            task_id       TEXT PRIMARY KEY,
            description   TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'pending',
            domain        TEXT,
            agent_name    TEXT,
            model_name    TEXT,
            final_score   REAL,
            error_message TEXT,
            token_input   INTEGER DEFAULT 0,
            token_output  INTEGER DEFAULT 0,
            token_cost    REAL DEFAULT 0.0,
            started_at    TEXT,
            completed_at  TEXT,
            created_at    TEXT DEFAULT (datetime('now')),
            updated_at    TEXT DEFAULT (datetime('now'))
        )
        """
    )

    # ── agent_logs ───────────────────────────────────────────────────────
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_logs (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id       TEXT NOT NULL,
            agent_name    TEXT,
            step          INTEGER DEFAULT 0,
            content       TEXT,
            token_input   INTEGER DEFAULT 0,
            token_output  INTEGER DEFAULT 0,
            timestamp     TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
        )
        """
    )

    # ── artifacts ────────────────────────────────────────────────────────
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS artifacts (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id        TEXT NOT NULL,
            artifact_path  TEXT NOT NULL,
            artifact_type  TEXT,
            file_size      INTEGER DEFAULT 0,
            created_at     TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
        )
        """
    )

    conn.commit()
    return conn


# ── Task CRUD ───────────────────────────────────────────────────────────────


def insert_task(
    conn: sqlite3.Connection,
    task_id: str,
    description: str,
    status: str = "pending",
    domain: Optional[str] = None,
    agent_name: Optional[str] = None,
    model_name: Optional[str] = None,
    final_score: Optional[float] = None,
    error_message: Optional[str] = None,
    token_input: int = 0,
    token_output: int = 0,
    token_cost: float = 0.0,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None,
) -> None:
    """Insert a new task (or replace if ``task_id`` already exists)."""
    conn.execute(
        """
        INSERT OR REPLACE INTO tasks
            (task_id, description, status, domain,
             agent_name, model_name, final_score, error_message,
             token_input, token_output, token_cost,
             started_at, completed_at, updated_at)
        VALUES
            (?, ?, ?, ?,
             ?, ?, ?, ?,
             ?, ?, ?,
             ?, ?, datetime('now'))
        """,
        (
            task_id, description, status, domain,
            agent_name, model_name, final_score, error_message,
            token_input, token_output, token_cost,
            started_at, completed_at,
        ),
    )
    conn.commit()


def update_task(
    conn: sqlite3.Connection,
    task_id: str,
    **fields: Any,
) -> bool:
    """Update one or more columns of a task.

    Accepts any column name as a keyword argument.  ``updated_at`` is
    always set to ``datetime('now')``.

    Returns ``True`` if the task existed, ``False`` otherwise.
    """
    allowed = {
        "description", "status", "domain", "agent_name", "model_name",
        "final_score", "error_message", "token_input", "token_output",
        "token_cost", "started_at", "completed_at",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False

    updates["updated_at"] = "datetime('now')"
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values())

    cur = conn.execute(
        f"UPDATE tasks SET {set_clause} WHERE task_id = ?",
        [v if v is not None else v for v in values] + [task_id],
    )
    conn.commit()
    return cur.rowcount > 0


def get_task(conn: sqlite3.Connection, task_id: str) -> Optional[Dict[str, Any]]:
    """Return a single task dict, or ``None`` if not found."""
    cur = conn.execute("SELECT * FROM tasks WHERE task_id = ?", (task_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def list_tasks(
    conn: sqlite3.Connection,
    *,
    status: Optional[str] = None,
    domain: Optional[str] = None,
    agent_name: Optional[str] = None,
    model_name: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    order_by: str = "created_at DESC",
) -> List[Dict[str, Any]]:
    """List tasks with optional filters.

    Parameters
    ----------
    conn : Connection
        Active database connection.
    status, domain, agent_name, model_name :
        Column-equality filters (``None`` means "no filter").
    limit :
        Maximum number of rows to return.
    offset :
        Number of rows to skip.
    order_by :
        SQL ``ORDER BY`` clause (default: newest first).
    """
    clauses: List[str] = []
    params: List[Any] = []

    if status is not None:
        clauses.append("status = ?")
        params.append(status)
    if domain is not None:
        clauses.append("domain = ?")
        params.append(domain)
    if agent_name is not None:
        clauses.append("agent_name = ?")
        params.append(agent_name)
    if model_name is not None:
        clauses.append("model_name = ?")
        params.append(model_name)

    where = " AND ".join(clauses) if clauses else "1"

    sql = f"SELECT * FROM tasks WHERE {where} ORDER BY {order_by}"
    if limit is not None:
        sql += f" LIMIT {limit} OFFSET {offset}"

    cur = conn.execute(sql, params)
    return [dict(row) for row in cur.fetchall()]


def search_tasks(
    conn: sqlite3.Connection,
    query: str,
    columns: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Search tasks by keyword in text columns.

    Parameters
    ----------
    conn :
        Active database connection.
    query :
        Keyword to search for (case-insensitive ``LIKE`` match).
    columns :
        Columns to search in.  Defaults to ``["description"]``.
    """
    if columns is None:
        columns = ["description"]
    clauses = [f"{c} LIKE ?" for c in columns]
    like = f"%{query}%"
    sql = f"SELECT * FROM tasks WHERE {' OR '.join(clauses)} ORDER BY updated_at DESC"
    cur = conn.execute(sql, [like] * len(columns))
    return [dict(row) for row in cur.fetchall()]


def delete_task(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    cascade: bool = False,
) -> bool:
    """Delete a single task.

    Parameters
    ----------
    cascade :
        If ``True``, also delete related ``agent_logs`` and ``artifacts``
        *before* deleting the task (since SQLite may not enforce FK
        cascades depending on pragma settings).
    """
    if cascade:
        delete_agent_logs_for_task(conn, task_id)
        delete_artifacts_for_task(conn, task_id)
    cur = conn.execute("DELETE FROM tasks WHERE task_id = ?", (task_id,))
    conn.commit()
    return cur.rowcount > 0


def delete_tasks_by_status(
    conn: sqlite3.Connection,
    status: str,
    *,
    cascade: bool = False,
) -> int:
    """Delete all tasks with the given status.

    Returns the number of deleted tasks.
    """
    if cascade:
        rows = conn.execute(
            "SELECT task_id FROM tasks WHERE status = ?", (status,)
        ).fetchall()
        for row in rows:
            delete_agent_logs_for_task(conn, row["task_id"])
            delete_artifacts_for_task(conn, row["task_id"])
    cur = conn.execute("DELETE FROM tasks WHERE status = ?", (status,))
    conn.commit()
    return cur.rowcount


def clear_all_tasks(conn: sqlite3.Connection) -> int:
    """Delete **all** tasks (and their logs/artifacts via CASCADE).

    Returns the number of remaining tasks (should be 0).
    """
    conn.execute("DELETE FROM agent_logs")
    conn.execute("DELETE FROM artifacts")
    conn.execute("DELETE FROM tasks")
    conn.commit()
    cur = conn.execute("SELECT COUNT(*) AS cnt FROM tasks")
    return cur.fetchone()["cnt"]


# ── Agent log CRUD ─────────────────────────────────────────────────────────


def insert_agent_log(
    conn: sqlite3.Connection,
    task_id: str,
    agent_name: str,
    content: str,
    *,
    step: int = 0,
    token_input: int = 0,
    token_output: int = 0,
    timestamp: Optional[str] = None,
) -> int:
    """Insert an agent log entry.

    Returns the new row ID.
    """
    cur = conn.execute(
        """
        INSERT INTO agent_logs (task_id, agent_name, step, content,
                                token_input, token_output, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        """,
        (task_id, agent_name, step, content,
         token_input, token_output, timestamp),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def get_agent_logs_for_task(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    order_by: str = "timestamp ASC",
) -> List[Dict[str, Any]]:
    """Return all log entries for a task."""
    cur = conn.execute(
        f"SELECT * FROM agent_logs WHERE task_id = ? ORDER BY {order_by}",
        (task_id,),
    )
    return [dict(row) for row in cur.fetchall()]


def delete_agent_logs_for_task(
    conn: sqlite3.Connection,
    task_id: str,
) -> int:
    """Delete all agent log entries for a task.

    Returns the number of deleted rows.
    """
    cur = conn.execute("DELETE FROM agent_logs WHERE task_id = ?", (task_id,))
    conn.commit()
    return cur.rowcount


# ── Artifact CRUD ───────────────────────────────────────────────────────────


def insert_artifact(
    conn: sqlite3.Connection,
    task_id: str,
    artifact_path: str,
    artifact_type: Optional[str] = None,
    *,
    file_size: int = 0,
) -> int:
    """Insert an artifact record.

    Returns the new row ID.
    """
    cur = conn.execute(
        """
        INSERT INTO artifacts (task_id, artifact_path, artifact_type, file_size)
        VALUES (?, ?, ?, ?)
        """,
        (task_id, artifact_path, artifact_type, file_size),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def get_artifacts_for_task(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    order_by: str = "created_at ASC",
) -> List[Dict[str, Any]]:
    """Return all artifact records for a task."""
    cur = conn.execute(
        f"SELECT * FROM artifacts WHERE task_id = ? ORDER BY {order_by}",
        (task_id,),
    )
    return [dict(row) for row in cur.fetchall()]


def delete_artifacts_for_task(
    conn: sqlite3.Connection,
    task_id: str,
) -> int:
    """Delete all artifact records for a task.

    Returns the number of deleted rows.
    """
    cur = conn.execute("DELETE FROM artifacts WHERE task_id = ?", (task_id,))
    conn.commit()
    return cur.rowcount


# ── Preview & Summary ───────────────────────────────────────────────────────


def preview_task(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    include_logs: bool = False,
    include_artifacts: bool = False,
) -> Optional[Dict[str, Any]]:
    """Return a detailed preview of a single task, optionally with side-data.

    Returns ``None`` if the task does not exist.
    """
    task = get_task(conn, task_id)
    if task is None:
        return None
    result: Dict[str, Any] = {"task": task}
    if include_logs:
        result["logs"] = get_agent_logs_for_task(conn, task_id)
    if include_artifacts:
        result["artifacts"] = get_artifacts_for_task(conn, task_id)
    return result


def preview_tasks_summary(
    conn: sqlite3.Connection,
    status: Optional[str] = None,
    domain: Optional[str] = None,
    agent_name: Optional[str] = None,
    *,
    limit: Optional[int] = 20,
) -> List[Dict[str, Any]]:
    """Return a lightweight list of tasks with only key fields."""
    tasks = list_tasks(
        conn,
        status=status,
        domain=domain,
        agent_name=agent_name,
        limit=limit,
        order_by="updated_at DESC",
    )
    summary_fields = {
        "task_id", "description", "status", "domain",
        "agent_name", "model_name", "final_score",
        "created_at", "updated_at",
    }
    return [
        {k: v for k, v in t.items() if k in summary_fields}
        for t in tasks
    ]


# ── Export helpers ─────────────────────────────────────────────────────────


def export_task_to_json(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    include_logs: bool = True,
    include_artifacts: bool = True,
    indent: Optional[int] = 2,
) -> str:
    """Export a single task (with logs/artifacts) as a JSON string.

    Raises ``ValueError`` if the task does not exist.
    """
    preview = preview_task(
        conn, task_id,
        include_logs=include_logs,
        include_artifacts=include_artifacts,
    )
    if preview is None:
        raise ValueError(f"Task '{task_id}' not found")
    return json.dumps(preview, ensure_ascii=False, indent=indent, default=str)


def export_all_tasks_to_json(
    conn: sqlite3.Connection,
    *,
    indent: Optional[int] = 2,
) -> str:
    """Export **all** tasks (without logs/artifacts) as a JSON array string."""
    tasks = list_tasks(conn)
    return json.dumps(tasks, ensure_ascii=False, indent=indent, default=str)


def export_task_to_file(
    conn: sqlite3.Connection,
    task_id: str,
    output_dir: str,
    *,
    include_logs: bool = True,
    include_artifacts: bool = True,
) -> str:
    """Export a task to a ``.json`` file inside *output_dir*.

    Returns the absolute path of the written file.
    """
    json_str = export_task_to_json(
        conn, task_id,
        include_logs=include_logs,
        include_artifacts=include_artifacts,
    )
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, f"{task_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(json_str)
    return os.path.abspath(file_path)


# ── Statistics & Maintenance ────────────────────────────────────────────────


def get_db_stats(conn: sqlite3.Connection) -> Dict[str, Any]:
    """Return aggregate statistics for the database."""
    stats: Dict[str, Any] = {}

    # Counts
    stats["total_tasks"] = conn.execute(
        "SELECT COUNT(*) FROM tasks"
    ).fetchone()[0]
    stats["total_agent_logs"] = conn.execute(
        "SELECT COUNT(*) FROM agent_logs"
    ).fetchone()[0]
    stats["total_artifacts"] = conn.execute(
        "SELECT COUNT(*) FROM artifacts"
    ).fetchone()[0]

    # Status / domain breakdowns
    stats["tasks_by_status"] = {
        row["status"]: row["cnt"]
        for row in conn.execute(
            "SELECT status, COUNT(*) AS cnt FROM tasks GROUP BY status"
        ).fetchall()
    }
    stats["tasks_by_domain"] = {
        row["domain"] or "(none)": row["cnt"]
        for row in conn.execute(
            "SELECT domain, COUNT(*) AS cnt FROM tasks GROUP BY domain"
        ).fetchall()
    }

    # Token / cost aggregates
    stats["total_token_input"] = conn.execute(
        "SELECT COALESCE(SUM(token_input), 0) FROM tasks"
    ).fetchone()[0]
    stats["total_token_output"] = conn.execute(
        "SELECT COALESCE(SUM(token_output), 0) FROM tasks"
    ).fetchone()[0]
    stats["total_token_cost"] = conn.execute(
        "SELECT COALESCE(SUM(token_cost), 0) FROM tasks"
    ).fetchone()[0]

    # Date range
    stats["earliest_task"] = conn.execute(
        "SELECT MIN(created_at) FROM tasks"
    ).fetchone()[0]
    stats["latest_task"] = conn.execute(
        "SELECT MAX(created_at) FROM tasks"
    ).fetchone()[0]

    # File size
    db_path = get_db_path()
    try:
        stats["db_size_bytes"] = os.path.getsize(db_path)
    except OSError:
        stats["db_size_bytes"] = 0

    return stats


def vacuum_db(conn: sqlite3.Connection) -> None:
    """Reclaim storage by running ``VACUUM``."""
    conn.execute("VACUUM")
    conn.commit()