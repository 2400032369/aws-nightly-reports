from datetime import datetime, timezone
import logging
from typing import Any
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from app.config import Settings
from app.schemas.report import LogsResponse

logger = logging.getLogger(__name__)


class CloudWatchService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client("logs", region_name=settings.aws_region)
        self.ecs = boto3.client("ecs", region_name=settings.aws_region)

    def task_logs(self, task_id: str) -> LogsResponse:
        try:
            task = self.ecs.describe_tasks(cluster=self.settings.ecs_cluster, tasks=[task_id]).get("tasks", [])
            if not task:
                raise HTTPException(404, f"Task {task_id} not found")
            container_names = [item.get("name") for item in task[0].get("containers", []) if item.get("name")]
            container_name = container_names[0] if container_names else self.settings.ecs_container_name
            prefix = f"{self.settings.cloudwatch_log_stream_prefix}/{container_name}/{task_id}"
            streams = self.client.describe_log_streams(
                logGroupName=self.settings.cloudwatch_log_group,
                logStreamNamePrefix=prefix,
            ).get("logStreams", [])
            events: list[Any] = []
            for stream in streams:
                token = None
                while True:
                    params = {
                        "logGroupName": self.settings.cloudwatch_log_group,
                        "logStreamName": stream["logStreamName"],
                        "startFromHead": True,
                    }
                    if token:
                        params["nextToken"] = token
                    response = self.client.get_log_events(**params)
                    for event in response.get("events", []):
                        message = event["message"].rstrip()
                        level = "ERROR" if "error" in message.lower() or "exception" in message.lower() else ("WARN" if "warn" in message.lower() else "INFO")
                        events.append({"timestamp": datetime.fromtimestamp(event["timestamp"] / 1000, timezone.utc), "message": message, "level": level})
                    next_token = response.get("nextForwardToken")
                    if not next_token or next_token == token:
                        break
                    token = next_token
            return LogsResponse(taskId=task_id, logGroup=self.settings.cloudwatch_log_group,
                                events=sorted(events, key=lambda event: event["timestamp"]))
        except HTTPException:
            raise
        except (BotoCoreError, ClientError) as exc:
            code = exc.response.get("Error", {}).get("Code")
            message = exc.response.get("Error", {}).get("Message", str(exc)) if isinstance(exc, ClientError) else str(exc)
            logger.exception("CloudWatch log read failed: %s", message)
            raise HTTPException(404 if code == "ResourceNotFoundException" else 502,
                                f"Unable to read CloudWatch logs: {message}") from exc
