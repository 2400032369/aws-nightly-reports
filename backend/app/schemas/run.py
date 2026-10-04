from datetime import datetime
from typing import Literal
from pydantic import BaseModel

TaskStatus = Literal["PROVISIONING", "PENDING", "RUNNING", "STOPPED"]


class TimelineEntry(BaseModel):
    status: Literal["CREATED", "PROVISIONING", "PENDING", "RUNNING", "STOPPED"]
    at: datetime


class Run(BaseModel):
    taskId: str
    taskArn: str
    status: TaskStatus
    trigger: Literal["SCHEDULER", "MANUAL"]
    createdAt: datetime
    startedAt: datetime | None = None
    stoppedAt: datetime | None = None
    durationSec: int | None = None
    exitCode: int | None = None
    stoppedReason: str | None = None
    cpu: str
    memory: str
    timeline: list[TimelineEntry]
