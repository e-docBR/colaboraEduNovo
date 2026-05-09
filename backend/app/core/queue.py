from redis import Redis
from rq import Queue
from .config import settings

redis_conn = Redis.from_url(
    settings.redis_url,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True
)
queue = Queue('default', connection=redis_conn)
