from fastapi import APIRouter
from fastapi.responses import Response
from app.config import get_settings
from app.schemas.report import Report, ReportMeta
from app.services.s3_service import S3Service

router = APIRouter()


@router.get("", response_model=list[ReportMeta])
def list_reports():
    return S3Service(get_settings()).report_metas()


@router.get("/{report_name}", response_model=Report)
def get_report(report_name: str):
    return S3Service(get_settings()).report(report_name)


@router.get("/{report_name}/download")
def download_report(report_name: str):
    body, name = S3Service(get_settings()).download(report_name)
    return Response(content=body, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{name}"'})
