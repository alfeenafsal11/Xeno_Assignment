from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "xeno_crm",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.task_routes = {"app.workers.*": {"queue": "campaigns"}}
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.timezone = "Asia/Kolkata"
celery_app.conf.broker_connection_retry_on_startup = True
celery_app.conf.imports = ["app.workers.campaign_tasks"]
