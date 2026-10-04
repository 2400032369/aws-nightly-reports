from datetime import datetime, timezone
from time import perf_counter
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter
from app.config import get_settings
from app.schemas.health import ServiceHealth
from app.services.cloudwatch_service import CloudWatchService
from app.services.ecs_service import EcsService
from app.services.s3_service import S3Service
from app.services.scheduler_service import SchedulerService

router = APIRouter()


@router.get("")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "aws-nightly-reports-backend"}


@router.get("/aws", response_model=list[ServiceHealth])
def aws_health() -> list[ServiceHealth]:
    settings = get_settings()
    checks = [
        ("s3", "Amazon S3", lambda: S3Service(settings).client.head_bucket(Bucket=settings.s3_bucket), settings.s3_bucket),
        ("ecs", "ECS / Fargate", lambda: EcsService(settings).client.describe_clusters(clusters=[settings.ecs_cluster]), f"{settings.ecs_cluster} · ACTIVE"),
        ("logs", "CloudWatch Logs", lambda: CloudWatchService(settings).client.describe_log_groups(logGroupNamePrefix=settings.cloudwatch_log_group), settings.cloudwatch_log_group),
        ("events", "EventBridge Scheduler", lambda: SchedulerService(settings).client.get_schedule(Name=settings.scheduler_name, GroupName=settings.scheduler_group), settings.scheduler_name),
    ]
    result = [ServiceHealth(id="api", name="Reports API", state="HEALTHY", latencyMs=0, detail="FastAPI", checkedAt=datetime.now(timezone.utc))]
    for service_id, name, check, detail in checks:
        started = perf_counter()
        try:
            check()
            state = "HEALTHY"
        except (BotoCoreError, ClientError) as exc:
            state = "DEGRADED"
            detail = str(exc)
        result.append(ServiceHealth(id=service_id, name=name, state=state, latencyMs=round((perf_counter() - started) * 1000),
                                    detail=detail, checkedAt=datetime.now(timezone.utc)))
    return result
