"""RQ worker startup with proper Redis connection settings."""
import os
import logging

from redis import Redis
from rq import Worker, Queue

logging.basicConfig(level=logging.INFO)

redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")

redis_conn = Redis.from_url(
    redis_url,
    socket_timeout=None,          # sem timeout — necessário para BLPOP/pubsub do worker
    socket_connect_timeout=10,
    socket_keepalive=True,        # mantém TCP vivo durante períodos ociosos
    retry_on_timeout=True,
    health_check_interval=25,     # redis-py verifica a conexão a cada 25s
)

queues = [Queue("default", connection=redis_conn)]
worker = Worker(queues, connection=redis_conn)

if __name__ == "__main__":
    worker.work(with_scheduler=True)
