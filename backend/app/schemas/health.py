from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class ServiceHealth(BaseModel):
    id: str
    name: str
    state: Literal["HEALTHY", "DEGRADED", "DOWN"]
    latencyMs: int
    detail: str
    checkedAt: datetime
