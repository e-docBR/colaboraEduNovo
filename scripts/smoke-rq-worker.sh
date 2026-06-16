#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
RQ_SMOKE_QUEUE="${RQ_SMOKE_QUEUE:-default}"
RQ_SMOKE_TIMEOUT_SECONDS="${RQ_SMOKE_TIMEOUT_SECONDS:-45}"

docker compose -f "$COMPOSE_FILE" exec -T \
  -e RQ_SMOKE_QUEUE="$RQ_SMOKE_QUEUE" \
  -e RQ_SMOKE_TIMEOUT_SECONDS="$RQ_SMOKE_TIMEOUT_SECONDS" \
  "$BACKEND_SERVICE" \
  python -c '
import json
import os
import sys
import time
import uuid

from rq import Queue

from app.core.queue import redis_conn
from app.core.tasks_smoke import rq_smoke_task

queue_name = os.environ.get("RQ_SMOKE_QUEUE", "default")
timeout = float(os.environ.get("RQ_SMOKE_TIMEOUT_SECONDS", "45"))
probe_id = uuid.uuid4().hex

queue = Queue(queue_name, connection=redis_conn)
job = queue.enqueue(
    rq_smoke_task,
    {"probe_id": probe_id},
    job_timeout=30,
    result_ttl=300,
    failure_ttl=300,
)

deadline = time.monotonic() + timeout
last_status = None

while time.monotonic() < deadline:
    job.refresh()
    last_status = job.get_status(refresh=False)
    if job.is_finished:
        result = job.return_value()
        if not isinstance(result, dict) or result.get("ok") is not True:
            print(f"RQ smoke job returned unexpected result: {json.dumps(result, default=str)}", file=sys.stderr)
            raise SystemExit(1)
        print(f"RQ smoke passed: job={job.id} queue={queue_name} probe={probe_id}")
        raise SystemExit(0)
    if job.is_failed:
        exc_info = job.exc_info or "no exception info"
        print(f"RQ smoke job failed: job={job.id}\n{exc_info}", file=sys.stderr)
        raise SystemExit(1)
    time.sleep(0.5)

print(
    f"RQ smoke timed out: job={job.id} queue={queue_name} last_status={last_status} "
    f"queued_jobs={queue.count}",
    file=sys.stderr,
)
raise SystemExit(1)
'
