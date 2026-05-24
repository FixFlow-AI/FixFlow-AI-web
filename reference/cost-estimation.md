# FixFlowAI AWS Cost Estimation

These are planning estimates only. Verify current pricing in the AWS Pricing Calculator before creating production resources.

## Starter Monthly Estimate

| Component | Suggested setup | Estimate |
|---|---|---:|
| Frontend | Amplify Hosting or S3 + CloudFront | `$1-$15` |
| Backend compute | ECS Fargate, 1 task, 0.25 vCPU, 1 GB | `$8-$20` |
| Load balancer | 1 Application Load Balancer | `$18-$30` |
| Container registry | ECR image storage | `$1-$3` |
| Database | DynamoDB on-demand, low traffic | `$1-$25` |
| Storage | S3 app bucket | `$1-$10` |
| Logs/alarms | CloudWatch with 30-day retention | `$1-$15` |
| DNS | Route 53 hosted zone and queries | `$1-$3` plus domain |
| Config/secrets | SSM standard parameters | `$0-$5` |
| Email | SES low volume | `$0-$5` |

Starter total without NAT/WAF: roughly `$35-$90/month`.

## Safer Production Estimate

| Component | Suggested setup | Estimate |
|---|---|---:|
| ECS | 1-2 Fargate tasks | `$20-$60` |
| ALB | Public ALB | `$18-$30` |
| NAT Gateway | 1 NAT Gateway | `$30-$70+` |
| WAF | Basic managed rules | `$5-$30+` |
| CloudWatch | Logs, alarms, dashboards | `$5-$30` |
| Other managed services | DynamoDB, S3, ECR, Route 53, SES | `$10-$70+` |

Safer production total: roughly `$90-$180/month`.

## Enterprise Baseline

- 2+ ECS tasks across two AZs.
- 2 NAT Gateways.
- WAF with managed and rate-based rules.
- DynamoDB GSIs and alarms.
- CloudFront logs and ALB access logs.
- Secrets Manager for sensitive credentials.
- CodeDeploy blue-green deployment.

Enterprise baseline: roughly `$180-$400+/month` before high traffic, AI provider costs, Stripe fees, and domain purchase.

## Cost Controls

- Use DynamoDB on-demand at launch.
- Keep CloudWatch log retention to 30 days.
- Use one ECS task until high availability is required.
- Use one NAT Gateway initially if private ECS networking is needed.
- Avoid Secrets Manager for non-secret config.
- Add ECR lifecycle cleanup.
- Cache Vite hashed assets aggressively in CloudFront.
- Review Cost Explorer weekly after launch.
