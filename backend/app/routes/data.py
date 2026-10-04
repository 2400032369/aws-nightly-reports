from fastapi import APIRouter, File, UploadFile
from app.config import get_settings
from app.schemas.report import InputMeta
from app.services.s3_service import S3Service

router = APIRouter()


@router.post("/upload", response_model=InputMeta)
async def upload_data(file: UploadFile = File(...)):
    return await S3Service(get_settings()).upload_input(file)


@router.get("/input", response_model=InputMeta)
def get_input():
    return S3Service(get_settings()).input_meta()
