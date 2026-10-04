# AWS Nightly Reports backend

FastAPI service for the existing React frontend. AWS credentials are resolved by the standard boto3 chain (local AWS CLI profile, environment, or an IAM task role).

## Local development

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Set ECS_SUBNET_IDS and ECS_SECURITY_GROUP_ID in .env
uvicorn app.main:app --reload --port 8000
```

The API is documented at `http://localhost:8000/docs`; `GET /api/health` is a local, credential-free liveness check. AWS-backed endpoints require valid IAM permissions and configured resources.
