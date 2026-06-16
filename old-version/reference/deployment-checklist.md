# FixFlowAI Deployment Checklist

Use this with `reference/roadmap.md`.

## Pre-Account

- [ ] Root MFA enabled.
- [ ] Admin IAM user/role created.
- [ ] Deploy IAM role/user created.
- [ ] Monthly AWS budget created.
- [ ] CloudTrail enabled.
- [ ] Primary region selected: `us-east-1`.

## Infrastructure

- [ ] VPC created.
- [ ] Two public subnets created.
- [ ] Two private subnets created.
- [ ] Internet Gateway attached.
- [ ] NAT Gateway decision made: skip for cheapest, use for production private ECS.
- [ ] ALB security group created.
- [ ] ECS task security group created.
- [ ] ECR repo `fixflowai-backend` created.
- [ ] S3 app bucket created, private, encrypted, versioned.
- [ ] DynamoDB tables created with `_id` hash key.
- [ ] DynamoDB PITR enabled.
- [ ] CloudWatch log group `/ecs/fixflowai-backend` created.
- [ ] SSM/Secrets Manager values created.

## Backend

- [ ] `backend/task-definition.json` account IDs, ARNs, image, and SSM paths replaced.
- [ ] Docker image builds locally.
- [ ] Docker image pushed to ECR.
- [ ] ECS task definition registered.
- [ ] ECS service created.
- [ ] ALB target group health check uses `/api/health`.
- [ ] ALB reports healthy target.
- [ ] API URL returns health JSON.

## Frontend

- [ ] `VITE_API_URL` set to production API URL.
- [ ] `npm run build` succeeds.
- [ ] Frontend deployed to Amplify or S3/CloudFront.
- [ ] SPA fallback routes work.
- [ ] CloudFront invalidation completed if using S3.

## Domain And SSL

- [ ] ACM certificate issued for frontend domain.
- [ ] ACM certificate issued for API domain or CloudFront API behavior.
- [ ] Route 53 records created.
- [ ] HTTP redirects to HTTPS.
- [ ] Cookies work over HTTPS.

## External Services

- [ ] GitHub OAuth callback set.
- [ ] Google OAuth callback set.
- [ ] Slack redirect URI set.
- [ ] Stripe webhook endpoint set.
- [ ] SES/domain SMTP configured.
- [ ] LLM provider keys configured.

## Smoke Tests

- [ ] Register user.
- [ ] Login.
- [ ] Refresh token.
- [ ] Upload brief file.
- [ ] Generate proposal stream.
- [ ] Proposal chat stream.
- [ ] Export PDF.
- [ ] Create portal.
- [ ] Submit portal event/feedback.
- [ ] Stripe checkout test.
- [ ] Slack integration test.
- [ ] Password reset email test.

## Go-Live

- [ ] WAF attached.
- [ ] CloudWatch alarms active.
- [ ] Backup/PITR confirmed.
- [ ] Rollback task definition known.
- [ ] Previous frontend artifact retained.
