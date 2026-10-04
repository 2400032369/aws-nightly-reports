from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    aws_region: str = "ap-south-2"
    s3_bucket: str = "nightly-reports-sreeprada-2026"
    s3_input_key: str = "sales.csv"
    s3_report_prefix: str = "reports"
    ecs_cluster: str = "nightly-reports-cluster"
    ecs_task_definition: str = "nightly-sales-report-task"
    ecs_subnet_ids: str = ""
    ecs_security_group_id: str = ""
    ecs_container_name: str = "nightly-sales-report"
    ecs_assign_public_ip: str = "ENABLED"
    ecs_cpu: str = "256"
    ecs_memory: str = "512"
    cloudwatch_log_group: str = "/ecs/nightly-sales-report"
    cloudwatch_log_stream_prefix: str = "ecs"
    scheduler_name: str = "nightly-sales-report-schedule"
    scheduler_group: str = "default"
    cors_origins: str = "http://localhost:5175,http://localhost:8080,http://localhost:5173,http://127.0.0.1:5175,http://127.0.0.1:8080,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @property
    def subnet_ids(self) -> list[str]:
        return [item.strip() for item in self.ecs_subnet_ids.split(",") if item.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
