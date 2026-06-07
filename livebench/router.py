"""
RouteManager: lightweight router that asks an LLM to select/rank agents
based on tool availability and task description.  This implements "方案 B"
(the generalist model as supervisor selects the best specialist agent).

It prefers agents that expose productivity tools (`create_file`, `execute_code_sandbox`).
"""
from __future__ import annotations

from typing import List, Dict, Any
from livebench.utils.llm_factory import get_chat_client
import os


class RouteManager:
    def __init__(self, model: str | None = None):
        self.model = model or os.getenv("ROUTER_MODEL") or os.getenv("LLM_MODEL")

    def rank_agents(self, task_description: str, agents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Return agents list sorted by suitability (best first).

        Each agent dict should contain at least `signature` and `basemodel`.
        We also include `supports_multimodal` and any other keys the config has.
        """
        # Build a simple prompt describing agents
        agent_lines = []
        for a in agents:
            tools = a.get("tools") or []
            supports = a.get("supports_multimodal", True)
            agent_lines.append(f"- {a.get('signature')} (model={a.get('basemodel')}, tools={tools}, multimodal={supports})")

        prompt = (
            "You are a supervisor. Given the task below and the available agents, rank them from best to worst for handling this task. "
            "Prefer agents that have both create_file and execute_code_sandbox capabilities and are specialized in the task domain. "
            "Return ONLY the ranked agent signatures in a JSON array.\n\n"
            "TASK:\n" + task_description + "\n\n"
            "AGENTS:\n" + "\n".join(agent_lines) + "\n\n"
            "Output example: [\"agent-a\", \"agent-b\"]"
        )

        try:
            client = get_chat_client(model=self.model, temperature=0.0)
            resp = client.invoke([{"role": "user", "content": prompt}])
            # Try to parse JSON from model output
            content = getattr(resp, "content", None) or str(resp)
            import json
            # Extract JSON array from content
            start = content.find("[")
            end = content.rfind("]")
            if start != -1 and end != -1 and end > start:
                arr_text = content[start:end+1]
                try:
                    sigs = json.loads(arr_text)
                    # Map back to agent dicts preserving only those present
                    sig_set = set(sigs)
                    ranked = [a for s in sigs for a in agents if a.get("signature") == s]
                    # Append any agents not mentioned at the end
                    remaining = [a for a in agents if a.get("signature") not in sig_set]
                    return ranked + remaining
                except Exception:
                    pass
        except Exception:
            # If LLM fails, fallback to simple heuristic
            pass

        # Fallback heuristic: prefer agents with explicit 'tools' containing target capabilities
        def score(a: Dict[str, Any]) -> int:
            tools = set(a.get("tools") or [])
            s = 0
            if "create_file" in tools:
                s += 2
            if "execute_code_sandbox" in tools or "execute_code" in tools:
                s += 2
            if a.get("supports_multimodal", False):
                s += 1
            return -s  # negative for ascending sort (we'll sort and reverse)

        ranked = sorted(agents, key=score)
        ranked.reverse()
        return ranked
