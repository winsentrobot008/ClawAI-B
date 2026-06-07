"""
Seed Script: Populate livebench/data/agent_data/ with realistic demo agent data.
This allows the dashboard to display agents and leaderboard without running the full simulation.

Usage: python scripts/seed_agent_data.py
"""

import json
import os
import random
from datetime import datetime, timedelta

random.seed(42)

AGENTS = [
    {"signature": "gpt-4-agent", "basemodel": "gpt-4", "initial_balance": 1000.0},
    {"signature": "claude-agent", "basemodel": "claude-sonnet-4-5", "initial_balance": 1000.0},
    {"signature": "gemini-agent", "basemodel": "gemini-2.0-pro", "initial_balance": 1000.0},
    {"signature": "qwen-agent", "basemodel": "qwen3-max", "initial_balance": 1000.0},
    {"signature": "deepseek-agent", "basemodel": "deepseek-chat", "initial_balance": 1000.0},
]

TASK_IDS = [
    "83d10b06-26d1-4636-a32c-23f92c57f30b",
    "7b08cd4d-df60-41ae-9102-8aaa49306ba2",
    "7d7fc9a7-21a7-4b83-906f-416dea5ad04f",
    "43dc9778-450b-4b46-b77e-b6d82b202035",
    "ee09d943-5a11-430a-b7a2-971b4e9b01b5",
    "f84ea6ac-8f9f-428c-b96c-d0884e30f7c7",
    "a328feea-47db-4856-b4be-2bdc63dd88fb",
    "27e8912c-8bd5-44ba-ad87-64066ea05264",
    "c44e9b62-7cd8-4f72-8ad9-f8fbddb94083",
    "99ac6944-4ec6-4848-959c-a460ac705c6f",
]

# Some tasks have known occupation/sector from task_values.jsonl
TASK_META = {
    "83d10b06-26d1-4636-a32c-23f92c57f30b": {"occupation": "Accountants and Auditors", "sector": "Professional, Scientific, and Technical Services"},
    "7b08cd4d-df60-41ae-9102-8aaa49306ba2": {"occupation": "Accountants and Auditors", "sector": "Professional, Scientific, and Technical Services"},
    "43dc9778-450b-4b46-b77e-b6d82b202035": {"occupation": "Accountants and Auditors", "sector": "Professional, Scientific, and Technical Services"},
    "f84ea6ac-8f9f-428c-b96c-d0884e30f7c7": {"occupation": "Administrative Services Managers", "sector": "Government"},
    "99ac6944-4ec6-4848-959c-a460ac705c6f": {"occupation": "Audio and Video Technicians", "sector": "Information"},
}

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "livebench", "data", "agent_data")


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def generate_balance_history(initial: float, num_days: int, base_income: float, base_cost: float):
    records = []
    balance = initial
    total_income = 0.0
    total_cost = 0.0

    # Initialization entry
    records.append({
        "date": "initialization",
        "balance": initial,
        "net_worth": initial,
        "survival_status": "thriving",
        "total_token_cost": 0.0,
        "total_work_income": 0.0,
        "daily_token_cost": 0.0,
        "work_income_delta": 0.0,
    })

    start_date = datetime(2025, 1, 20)
    for i in range(num_days):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        income = round(random.uniform(base_income * 0.5, base_income * 1.5), 2)
        cost = round(random.uniform(base_cost * 0.3, base_cost * 1.2), 4)
        total_income += income
        total_cost += cost
        balance = round(initial + total_income - total_cost, 2)
        net_worth = round(balance + random.uniform(0, 50), 2)

        # Survival status
        if balance <= 0:
            status = "bankrupt"
        elif balance < initial * 0.5:
            status = "struggling"
        elif balance < initial * 2:
            status = "stable"
        else:
            status = "thriving"

        records.append({
            "date": date,
            "balance": balance,
            "net_worth": net_worth,
            "survival_status": status,
            "total_token_cost": round(total_cost, 4),
            "total_work_income": round(total_income, 2),
            "daily_token_cost": round(cost, 4),
            "work_income_delta": income,
        })

    return records


def generate_decisions(num_days: int, agent_sig: str):
    records = []
    start_date = datetime(2025, 1, 20)
    for i in range(num_days):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        activity = random.choices(["work", "learn"], weights=[0.7, 0.3])[0]
        records.append({
            "date": date,
            "activity": activity,
            "reasoning": f"Agent {agent_sig} decided to {activity} on {date}",
            "timestamp": f"{date}T{random.randint(8, 18):02d}:{random.randint(0, 59):02d}:00Z",
        })
    return records


def generate_evaluations(agent_sig: str, num_tasks: int):
    records = []
    start_date = datetime(2025, 1, 20)
    for i in range(num_tasks):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        task_id = TASK_IDS[i % len(TASK_IDS)]
        score = round(random.uniform(0.3, 1.0), 4)
        payment = round(score * random.uniform(80, 500), 2)
        records.append({
            "task_id": task_id,
            "date": date,
            "agent_signature": agent_sig,
            "evaluation_score": score,
            "evaluation_method": "llm" if score > 0.5 else "heuristic",
            "payment": payment,
            "feedback": "Completed task with satisfactory quality." if score > 0.5 else "Task output needs improvement.",
        })
    return records


def generate_task_completions(agent_sig: str, num_tasks: int):
    records = []
    start_date = datetime(2025, 1, 20)
    for i in range(num_tasks):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        task_id = TASK_IDS[i % len(TASK_IDS)]
        wall_clock = random.randint(300, 7200)
        records.append({
            "task_id": task_id,
            "date": date,
            "agent_signature": agent_sig,
            "work_submitted": True,
            "money_earned": round(random.uniform(50, 500), 2),
            "wall_clock_seconds": wall_clock,
            "timestamp": f"{date}T{random.randint(8, 18):02d}:{random.randint(0, 59):02d}:00Z",
        })
    return records


def generate_tasks(agent_sig: str, num_tasks: int):
    records = []
    start_date = datetime(2025, 1, 20)
    for i in range(num_tasks):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        task_id = TASK_IDS[i % len(TASK_IDS)]
        meta = TASK_META.get(task_id, {"occupation": "General", "sector": "General"})
        records.append({
            "task_id": task_id,
            "date": date,
            "agent_signature": agent_sig,
            "sector": meta["sector"],
            "occupation": meta["occupation"],
            "prompt": f"Complete a professional task in {meta['occupation']} for the {meta['sector']} sector.",
            "status": "completed",
        })
    return records


def main():
    print("🌱 Seeding agent data...")

    for agent in AGENTS:
        sig = agent["signature"]
        initial = agent["initial_balance"]
        ensure_dir(os.path.join(BASE_DIR, sig, "economic"))
        ensure_dir(os.path.join(BASE_DIR, sig, "decisions"))
        ensure_dir(os.path.join(BASE_DIR, sig, "work"))
        ensure_dir(os.path.join(BASE_DIR, sig, "memory"))

        # Vary the number of days per agent for a more realistic leaderboard
        num_days = random.randint(3, 8)

        # --- ECONOMIC / balance.jsonl ---
        base_income = random.uniform(100, 300)
        base_cost = random.uniform(5, 30)
        balance_records = generate_balance_history(initial, num_days, base_income, base_cost)
        with open(os.path.join(BASE_DIR, sig, "economic", "balance.jsonl"), "w") as f:
            for rec in balance_records:
                f.write(json.dumps(rec) + "\n")

        # --- DECISIONS / decisions.jsonl ---
        decision_records = generate_decisions(num_days, sig)
        with open(os.path.join(BASE_DIR, sig, "decisions", "decisions.jsonl"), "w") as f:
            for rec in decision_records:
                f.write(json.dumps(rec) + "\n")

        # --- WORK / evaluations.jsonl ---
        num_tasks = random.randint(2, min(num_days, 6))
        eval_records = generate_evaluations(sig, num_tasks)
        with open(os.path.join(BASE_DIR, sig, "work", "evaluations.jsonl"), "w") as f:
            for rec in eval_records:
                f.write(json.dumps(rec) + "\n")

        # --- WORK / tasks.jsonl ---
        task_records = generate_tasks(sig, num_tasks)
        with open(os.path.join(BASE_DIR, sig, "work", "tasks.jsonl"), "w") as f:
            for rec in task_records:
                f.write(json.dumps(rec) + "\n")

        # --- ECONOMIC / task_completions.jsonl ---
        completion_records = generate_task_completions(sig, num_tasks)
        with open(os.path.join(BASE_DIR, sig, "economic", "task_completions.jsonl"), "w") as f:
            for rec in completion_records:
                f.write(json.dumps(rec) + "\n")

        # --- MEMORY / memory.jsonl ---
        memory_entries = [
            {"topic": "Task Strategies", "knowledge": "Prioritize tasks with higher payment potential.", "timestamp": "2025-01-21T10:00:00Z", "date": "2025-01-21"},
            {"topic": "Cost Management", "knowledge": "Use concise prompts to reduce token costs.", "timestamp": "2025-01-22T14:30:00Z", "date": "2025-01-22"},
        ]
        with open(os.path.join(BASE_DIR, sig, "memory", "memory.jsonl"), "w") as f:
            for rec in memory_entries:
                f.write(json.dumps(rec) + "\n")

        latest_balance = balance_records[-1]
        print(f"  ✓ {sig:20s} | tasks: {num_tasks} | balance: ${latest_balance['balance']:>8.2f} | status: {latest_balance['survival_status']}")

    print(f"\n✅ Seed data written to: {BASE_DIR}")
    print("🚀 Restart the API server to see agents on the dashboard.")


if __name__ == "__main__":
    main()