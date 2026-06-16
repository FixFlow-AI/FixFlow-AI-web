# FixFlowAI AWS Security Guide

## Application Security Already In Code

- Helmet security headers.
- CORS allowlist.
- Origin guard.
- CSRF protection.
- JWT access token plus refresh cookie.
- HTTP-only cookie handling.
- Express rate limits.
- Request IDs.
- DynamoDB audit logging.
- Suspicious activity middleware.
- Input sanitization and Zod schemas.
- S3 file ownership checks.
- Stripe webhook signature validation path.

## Required AWS Security Controls

- Enable MFA on root and admin users.
- Use IAM roles instead of AWS keys in ECS.
- Store secrets in SSM SecureString or Secrets Manager.
- Block all public access on the app S3 bucket.
- Use least-privilege DynamoDB and S3 permissions.
- Put ECS tasks behind ALB.
- Allow ECS port `5000` only from the ALB security group.
- Attach WAF to CloudFront.
- Enable CloudTrail.
- Set CloudWatch log retention.
- Enable ECR scan on push.

## Recommended WAF Rules

- AWS Managed Rules Common Rule Set.
- Known Bad Inputs.
- Amazon IP Reputation List.
- Rate-based rule for auth routes.
- Rate-based rule for AI generation/chat routes.
- Optional Bot Control only after measuring cost.

## Secrets To Protect

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- OAuth client secrets.
- SMTP credentials.
- Stripe secret and webhook secret.
- Gemini/OpenRouter/xAI/Ollama API keys.
- Apify/Tavily/Brave/SerpAPI keys.
- Slack client secret.
- `INTEGRATION_SECRET`

Never expose backend secrets in frontend `VITE_` variables.

## Production Cookie Requirements

- Serve API over HTTPS.
- Set `NODE_ENV=production`.
- Ensure frontend and API domains are in `FRONTEND_ALLOWED_ORIGINS`.
- Forward `Cookie`, `Authorization`, and `X-CSRF-Token` through CloudFront API behavior if CloudFront fronts the API.
