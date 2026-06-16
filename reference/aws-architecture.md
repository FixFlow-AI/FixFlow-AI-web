# FixFlowAI AWS Architecture

```mermaid

flowchart TD
  User[Browser] --> R53[Route 53]
  R53 --> CF[CloudFront + WAF]
  CF --> Frontend[Amplify Hosting or S3 Frontend]
  CF --> ALB[Application Load Balancer]
  ALB --> ECS[ECS Fargate Backend]
  ECS --> DDB[DynamoDB]
  ECS --> S3[S3 App Bucket]
  ECS --> SSM[SSM / Secrets Manager]
  ECS --> CW[CloudWatch]
  ECS --> SES[SES SMTP]
  ECS --> Stripe[Stripe]
  ECS --> LLM[Gemini / OpenRouter / xAI / Ollama]
  ECS --> Slack[Slack]
  CF --> APIGW[Optional API Gateway]
  APIGW --> Lambda[Optional Waitlist Lambda]
  Lambda --> Waitlist[fixflowai_waitlist DynamoDB]
```

## Required Runtime Services

- Frontend hosting: Amplify Hosting or S3 + CloudFront.
- Backend hosting: ECS Fargate.
- Backend ingress: ALB.
- Database: DynamoDB.
- Object storage: S3.
- Secrets/config: SSM Parameter Store or Secrets Manager.
- Logs/metrics: CloudWatch.
- DNS/TLS: Route 53 and ACM.

## Optional Runtime Services

- WAF for production edge protection.
- API Gateway + Lambda for standalone waitlist.
- SES for AWS-native SMTP.
- ElastiCache Redis later for shared rate limits or pub/sub.
- SQS/SNS later for background jobs and notifications.

## Not Required For Current Code

- RDS.
- MongoDB.
- Kubernetes/EKS.
- nginx.
- Redis at launch.
- WebSocket API.
