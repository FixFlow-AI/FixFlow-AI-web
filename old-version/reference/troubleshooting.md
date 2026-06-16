# FixFlowAI AWS Troubleshooting

## ECS Task Stops Immediately

Check logs:

```powershell
aws logs tail /ecs/fixflowai-backend --follow --region us-east-1
```

Likely causes:

- Missing `JWT_SECRET` or `JWT_REFRESH_SECRET`.
- ECS cannot read SSM parameters.
- DynamoDB tables are missing.
- Task role lacks DynamoDB permissions.
- Memory too low for Chromium/Puppeteer.

## CORS Errors

Fix:

- `FRONTEND_URL=https://fixflowai.com`
- `FRONTEND_ALLOWED_ORIGINS=https://fixflowai.com,https://www.fixflowai.com`
- `VITE_API_URL=https://api.fixflowai.com/api`
- Backend redeployed after env change.

## Login Or Refresh Fails

Check:

- API is HTTPS.
- `NODE_ENV=production`.
- Browser receives refresh cookie.
- CloudFront forwards `Cookie`, `Authorization`, `X-CSRF-Token`.
- API behavior is not cached.

## SSE Stream Fails

Fix:

- ALB idle timeout at least 180 seconds.
- Do not cache stream endpoints.
- Confirm WAF is not blocking long responses.
- Check LLM provider key and rate limit logs.

## S3 Upload Fails

Check:

- Bucket name equals `S3_BUCKET`.
- S3 CORS allows frontend origin.
- ECS task role can `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`.
- File type is allowed: PDF, DOCX, TXT, PNG, JPG, WEBP.

## Stripe Webhook Fails

Check:

- Correct webhook route under `/api/billing`.
- `STRIPE_WEBHOOK_SECRET` matches Stripe endpoint.
- `stripe-signature` header reaches backend.
- CloudFront does not cache webhook route.

## OAuth Callback Fails

Use exact callback URLs:

- GitHub: `https://api.fixflowai.com/api/auth/github/callback`
- Google: `https://api.fixflowai.com/api/auth/google/callback`
- Slack: `https://api.fixflowai.com/api/integrations/slack/callback`

## DynamoDB Is Slow Or Expensive

Current code scans tables for many filters. This is acceptable only for small launch traffic. Add GSIs and query-based access patterns for `User.email`, `Proposal.createdBy`, `Proposal.workspaceId`, `Notification.userId`, `Session.userId`, and `Portal.token`.
