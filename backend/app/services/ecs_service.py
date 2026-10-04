from datetime import datetime, timezone
import logging
from typing import Any
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException
from app.config import Settings
from app.schemas.run import Run

logger = logging.getLogger(__name__)


def _dt(value: Any) -> datetime | None:
    return value.astimezone(timezone.utc) if isinstance(value, datetime) else None


class EcsService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client("ecs", region_name=settings.aws_region)

    def start(self) -> Run:
        if not self.settings.subnet_ids or not self.settings.ecs_security_group_id:
            raise HTTPException(500, "ECS subnet and security group configuration is required")
        try:
            response = self.client.run_task(
                cluster=self.settings.ecs_cluster,
                taskDefinition=self.settings.ecs_task_definition,
                launchType="FARGATE",
                platformVersion="LATEST",
                startedBy="nightly-reports-api",
                networkConfiguration={"awsvpcConfiguration": {
                    "subnets": self.settings.subnet_ids,
                    "securityGroups": [self.settings.ecs_security_group_id],
                    "assignPublicIp": self.settings.ecs_assign_public_ip,
                }},
                tags=[{"key": "trigger", "value": "MANUAL"}],
            )
        except (BotoCoreError, ClientError) as exc:
            message = _aws_message(exc)
            logger.exception("ECS RunTask failed: %s", message)
            raise HTTPException(502, f"Unable to start ECS task: {message}") from exc
        failures = response.get("failures", [])
        if failures:
            reason = failures[0].get("reason", "unknown error")
            logger.error("ECS rejected RunTask: %s", reason)
            raise HTTPException(502, f"ECS rejected task: {reason}")
        if not response.get("tasks"):
            raise HTTPException(502, "ECS accepted the request but returned no task")
        task = response["tasks"][0]
        return self._to_run(task)

    def get(self, task_id: str) -> Run:
        try:
            response = self.client.describe_tasks(cluster=self.settings.ecs_cluster, tasks=[task_id], include=["TAGS"])
        except (BotoCoreError, ClientError) as exc:
            message = _aws_message(exc)
            logger.exception("ECS DescribeTasks failed: %s", message)
            raise HTTPException(502, f"Unable to read ECS task: {message}") from exc
        if not response.get("tasks"):
            raise HTTPException(404, f"Task {task_id} not found")
        return self._to_run(response["tasks"][0])

    def list(self) -> list[Run]:
        try:
            arns: list[str] = []
            for desired in ("RUNNING", "STOPPED"):
                paginator = self.client.get_paginator("list_tasks")
                for page in paginator.paginate(cluster=self.settings.ecs_cluster, desiredStatus=desired):
                    arns.extend(page.get("taskArns", []))
            if not arns:
                return []
            details = self.client.describe_tasks(cluster=self.settings.ecs_cluster, tasks=arns, include=["TAGS"]).get("tasks", [])
            return sorted((self._to_run(task) for task in details), key=lambda run: run.createdAt, reverse=True)
        except (BotoCoreError, ClientError) as exc:
            message = _aws_message(exc)
            logger.exception("ECS ListTasks failed: %s", message)
            raise HTTPException(502, f"Unable to list ECS tasks: {message}") from exc

    def _to_run(self, task: dict[str, Any]) -> Run:
        created = _dt(task.get("createdAt")) or datetime.now(timezone.utc)
        started = _dt(task.get("startedAt"))
        stopped = _dt(task.get("stoppedAt"))
        status = task.get("lastStatus", "PENDING")
        if status not in {"PROVISIONING", "PENDING", "RUNNING", "STOPPED"}:
            status = "PENDING"
        container = (task.get("containers") or [{}])[0]
        exit_code = container.get("exitCode") if status == "STOPPED" else None
        tags = {tag.get("key"): tag.get("value") for tag in task.get("tags", [])}
        timeline = [{"status": "CREATED", "at": created}]
        for key, value in (("PROVISIONING", task.get("pullStartedAt")), ("PENDING", task.get("pullStoppedAt")),
                           ("RUNNING", started), ("STOPPED", stopped)):
            timestamp = _dt(value)
            if timestamp and timestamp >= created:
                timeline.append({"status": key, "at": timestamp})
        return Run(
            taskId=task["taskArn"].rsplit("/", 1)[-1],
            taskArn=task["taskArn"],
            status=status,
            trigger=tags.get("trigger", "MANUAL"),
            createdAt=created,
            startedAt=started,
            stoppedAt=stopped,
            durationSec=round((stopped - started).total_seconds()) if started and stopped else None,
            exitCode=exit_code,
            stoppedReason=task.get("stoppedReason"),
            cpu=str(task.get("cpu", self.settings.ecs_cpu)),
            memory=str(task.get("memory", self.settings.ecs_memory)),
            timeline=timeline,
        )


def _aws_message(exc: BaseException) -> str:
    if isinstance(exc, ClientError):
        return exc.response.get("Error", {}).get("Message", str(exc))
    return str(exc)
