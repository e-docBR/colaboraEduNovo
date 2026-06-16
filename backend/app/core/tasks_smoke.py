from datetime import UTC, datetime
from typing import Any


def rq_smoke_task(payload: dict[str, Any]) -> dict[str, Any]:
    """Tiny deterministic task used by production smoke checks."""
    return {
        "ok": True,
        "payload": payload,
        "processed_at": datetime.now(UTC).isoformat(),
    }
