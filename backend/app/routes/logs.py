from fastapi import APIRouter
from app.config import get_settings
from app.schemas.report import LogsResponse
from app.services.cloudwatch_service import CloudWatchService

router = APIRouter()


@router.get("/{task_id}/logs", response_model=LogsResponse)
def get_logs(task_id: str):
    return CloudWatchService(get_settings()).task_logs(task_id)
