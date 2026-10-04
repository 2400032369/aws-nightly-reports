
import boto3
import pandas as pd
from pathlib import Path

# AWS S3 configuration
BUCKET_NAME = "nightly-reports-sreeprada-2026"
INPUT_KEY = "sales.csv"
OUTPUT_KEY = "reports/nightly_sales_report.csv"

# Project directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
REPORT_DIR = BASE_DIR / "reports"

DATA_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

LOCAL_CSV = DATA_DIR / "sales.csv"
LOCAL_REPORT = REPORT_DIR / "nightly_sales_report.csv"


def generate_report():
    print("Starting Nightly Sales Report...")

    # Connect to S3 using AWS CLI credentials
    s3 = boto3.client("s3", region_name="ap-south-1")

    # Download sales data from S3
    print("Downloading sales.csv from S3...")
    s3.download_file(BUCKET_NAME, INPUT_KEY, str(LOCAL_CSV))

    # Read sales data
    df = pd.read_csv(LOCAL_CSV)

    # Calculate total sales for each order
    df["total_sales"] = df["quantity"] * df["unit_price"]

    # Generate product-wise sales report
    report = (
        df.groupby("product")
        .agg(
            total_quantity=("quantity", "sum"),
            total_revenue=("total_sales", "sum"),
            number_of_orders=("order_id", "count")
        )
        .reset_index()
    )

    # Save report locally
    report.to_csv(LOCAL_REPORT, index=False)

    print("\nSales Report:")
    print(report.to_string(index=False))

    # Upload generated report to S3
    print("\nUploading report to S3...")
    s3.upload_file(
        str(LOCAL_REPORT),
        BUCKET_NAME,
        OUTPUT_KEY
    )

    print("\nSUCCESS! Nightly sales report generated.")
    print(f"Local report: {LOCAL_REPORT}")
    print(f"S3 report: s3://{BUCKET_NAME}/{OUTPUT_KEY}")


if __name__ == "__main__":
    generate_report()
