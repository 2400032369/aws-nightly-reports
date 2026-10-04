from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from app.config import Settings
from app.schemas.report import Scheduler

logger = logging.getLogger(__name__)


class SchedulerService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client("scheduler", region_name=settings.aws_region)

    def get(self) -> Scheduler:
        try:
            item = self.client.get_schedule(Name=self.settings.scheduler_name, GroupName=self.settings.scheduler_group)
        except (BotoCoreError, ClientError) as exc:
            if isinstance(exc, ClientError) and exc.response.get("Error", {}).get("Code") == "ResourceNotFoundException":
                raise HTTPException(404, "Scheduler configuration not found") from exc
            message = exc.response.get("Error", {}).get("Message", str(exc)) if isinstance(exc, ClientError) else str(exc)
            logger.exception("EventBridge Scheduler read failed: %s", message)
            raise HTTPException(502, f"Unable to read scheduler configuration: {message}") from exc
        target = item.get("Target", {})
        expression = item.get("ScheduleExpression", "")
        return Scheduler(name=self.settings.scheduler_name, state=item.get("State", "DISABLED"), expression=expression,
                         frequency=_frequency(expression),
                         timezone=item.get("ScheduleExpressionTimezone", "UTC"),
                         target=target.get("EcsParameters", {}).get("TaskDefinitionArn", target.get("Arn", "")),
                         cluster=target.get("EcsParameters", {}).get("Cluster", self.settings.ecs_cluster),
                         nextRun=_next_run(expression, item.get("ScheduleExpressionTimezone", "UTC")),
                         lastRun=None)


def _frequency(expression: str) -> str:
    if expression.startswith("rate("):
        return expression
    if expression.startswith("cron("):
        return f"Cron {expression[5:-1]}"
    return expression


def _next_run(expression: str, timezone_name: str) -> datetime | None:
    if not expression.startswith("cron("):
        return None
    fields = expression[5:-1].split()
    if len(fields) != 6 or any(value not in {"*", "?"} for value in fields[2:]):
        return None
    try:
        minute, hour = int(fields[0]), int(fields[1])
        zone = ZoneInfo(timezone_name)
    except (ValueError, KeyError):
        return None
    local_now = datetime.now(zone)
    candidate = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= local_now:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)
