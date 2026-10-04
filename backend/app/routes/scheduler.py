from fastapi import APIRouter
from app.config import get_settings
from app.schemas.report import Scheduler
from app.services.scheduler_service import SchedulerService

router = APIRouter()


@router.get("", response_model=Scheduler)
def get_scheduler():
    return SchedulerService(get_settings()).get()
