from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes import data, health, logs, reports, runs, scheduler

app = FastAPI(title="AWS Nightly Reports API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origin_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(logs.router, prefix="/api/runs", tags=["logs"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(scheduler.router, prefix="/api/scheduler", tags=["scheduler"])
