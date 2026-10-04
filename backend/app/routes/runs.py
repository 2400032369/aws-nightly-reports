from fastapi import APIRouter
from app.config import get_settings
from app.schemas.run import Run
from app.services.ecs_service import EcsService

router = APIRouter()


@router.post("", response_model=Run, status_code=201)
def start_run():
    return EcsService(get_settings()).start()


@router.get("", response_model=list[Run])
def list_runs():
    return EcsService(get_settings()).list()


@router.get("/{task_id}", response_model=Run)
def get_run(task_id: str):
    return EcsService(get_settings()).get(task_id)
