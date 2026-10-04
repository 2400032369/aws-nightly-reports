import csv
import io
from typing import Any
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile
from app.config import Settings
from app.schemas.report import InputMeta, Report, ReportMeta, ReportRow

REQUIRED_COLUMNS = ["order_id", "order_date", "product", "quantity", "unit_price"]


class S3Service:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client("s3", region_name=settings.aws_region)

    def _error(self, action: str, exc: ClientError) -> HTTPException:
        code = exc.response.get("Error", {}).get("Code")
        return HTTPException(404 if code in {"NoSuchKey", "404", "NotFound"} else 502, f"Unable to {action}")

    def input_meta(self) -> InputMeta:
        try:
            head = self.client.head_object(Bucket=self.settings.s3_bucket, Key=self.settings.s3_input_key)
            body = self.client.get_object(Bucket=self.settings.s3_bucket, Key=self.settings.s3_input_key)["Body"].read()
        except ClientError as exc:
            raise self._error("read input data", exc) from exc
        rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
        return InputMeta(bucket=self.settings.s3_bucket, key=self.settings.s3_input_key, sizeBytes=head["ContentLength"],
                         lastModified=head["LastModified"], rowCount=max(0, len(rows) - 1),
                         columns=[column.strip() for column in (rows[0] if rows else [])])

    async def upload_input(self, file: UploadFile) -> InputMeta:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(400, "A CSV file is required")
        body = await file.read()
        try:
            rows = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
        except UnicodeDecodeError as exc:
            raise HTTPException(400, "CSV must be UTF-8 encoded") from exc
        columns = list(rows[0].keys()) if rows else []
        missing = [column for column in REQUIRED_COLUMNS if column not in columns]
        if missing:
            raise HTTPException(422, f"Missing required columns: {', '.join(missing)}")
        for index, row in enumerate(rows, 2):
            try:
                float(row["quantity"])
                float(row["unit_price"])
            except (TypeError, ValueError) as exc:
                raise HTTPException(422, f"Invalid numeric value on CSV row {index}") from exc
        try:
            self.client.put_object(Bucket=self.settings.s3_bucket, Key=self.settings.s3_input_key, Body=body, ContentType="text/csv")
        except ClientError as exc:
            raise self._error("upload input data", exc) from exc
        return self.input_meta()

    def _objects(self) -> list[dict[str, Any]]:
        try:
            response = self.client.list_objects_v2(Bucket=self.settings.s3_bucket, Prefix=f"{self.settings.s3_report_prefix}/")
            return [item for item in response.get("Contents", []) if item["Key"].lower().endswith(".csv")]
        except ClientError as exc:
            raise self._error("list reports", exc) from exc

    def report_metas(self) -> list[ReportMeta]:
        return [ReportMeta(name=item["Key"].rsplit("/", 1)[-1], key=item["Key"], bucket=self.settings.s3_bucket,
                            sizeBytes=item["Size"], lastModified=item["LastModified"]) for item in self._objects()]

    def report(self, name: str) -> Report:
        meta = next((item for item in self.report_metas() if item.name == name), None)
        if not meta:
            raise HTTPException(404, f"Report {name} not found")
        try:
            body = self.client.get_object(Bucket=meta.bucket, Key=meta.key)["Body"].read().decode("utf-8-sig")
        except ClientError as exc:
            raise self._error("read report", exc) from exc
        reader = csv.DictReader(io.StringIO(body))
        rows = [ReportRow(product=row.get("product", ""), totalQuantity=float(row.get("total_quantity", 0)),
                          totalRevenue=float(row.get("total_revenue", 0)), orderCount=int(row.get("order_count", 0))) for row in reader]
        return Report(**meta.model_dump(), rows=rows)

    def download(self, name: str) -> tuple[bytes, str]:
        meta = next((item for item in self.report_metas() if item.name == name), None)
        if not meta:
            raise HTTPException(404, f"Report {name} not found")
        try:
            return self.client.get_object(Bucket=meta.bucket, Key=meta.key)["Body"].read(), name
        except ClientError as exc:
            raise self._error("download report", exc) from exc
