# AWS Fargate Batch Processing for Nightly Reports

## Project Overview

This project automates nightly sales report generation using AWS serverless container services.

The application retrieves sales data from Amazon S3, processes it using Python and Pandas inside a Docker container, generates a sales report, and uploads the generated report back to Amazon S3.

The container runs as an Amazon ECS Fargate task, while Amazon CloudWatch is used for application logging and monitoring.

## Architecture

S3 → EventBridge Scheduler → ECS Fargate → Python/Pandas → S3

CloudWatch Logs monitors the Fargate task execution.

## AWS Services Used

- Amazon S3
- Amazon ECS
- AWS Fargate
- Amazon ECR
- Amazon EventBridge Scheduler
- Amazon CloudWatch
- AWS IAM
- Amazon VPC

## Technologies Used

- Python 3.12
- Pandas
- Boto3
- Docker
- Amazon ECR
- Amazon ECS Fargate
- AWS SDK for Python

## Project Structure

```text
aws-nightly-reports/
│
├── app/
│   └── main.py
│
├── data/
│   └── sales.csv
│
├── reports/
│   ├── daily_sales_report.csv
│   └── nightly_sales_report.csv
│
├── Dockerfile
├── requirements.txt
├── .gitignore
└── README.md
