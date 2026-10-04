from datetime import datetime
from pydantic import BaseModel


class ReportRow(BaseModel):
    product: str
    totalQuantity: float
    totalRevenue: float
    orderCount: int


class ReportMeta(BaseModel):
    name: str
    key: str
    bucket: str
    sizeBytes: int
    lastModified: datetime


class Report(ReportMeta):
    rows: list[ReportRow]


class InputMeta(BaseModel):
    bucket: str
    key: str
    sizeBytes: int
    lastModified: datetime
    rowCount: int
    columns: list[str]


class LogEvent(BaseModel):
    timestamp: datetime
    message: str
    level: str


class LogsResponse(BaseModel):
    taskId: str
    logGroup: str
    events: list[LogEvent]


class Scheduler(BaseModel):
    name: str
    state: str
    expression: str
    frequency: str
    timezone: str
    target: str
    cluster: str
    nextRun: datetime | None = None
    lastRun: datetime | None = None
