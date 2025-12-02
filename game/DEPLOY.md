# AWS Deployment Guide

## Option 1: AWS Amplify (Recommended - Easiest)

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click "New app" → "Host web app"
3. Connect your Git repository (GitHub, GitLab, etc.)
4. Select the branch to deploy
5. Amplify auto-detects the `amplify.yml` config
6. **Add Environment Variable:**
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
7. Deploy!

Amplify provides:
- Automatic builds on git push
- HTTPS with custom domain support
- Preview branches
- Automatic CI/CD

## Option 2: S3 + CloudFront (Manual)

### Build locally:
```bash
cd game
npm ci
npm run build
```

### Upload to S3:
```bash
aws s3 sync dist/ s3://YOUR-BUCKET-NAME/ --delete
```

### CloudFront invalidation:
```bash
aws cloudfront create-invalidation --distribution-id YOUR-DIST-ID --paths "/*"
```

## Option 3: CodeBuild + S3/CloudFront (CI/CD)

1. Create an S3 bucket for hosting
2. Create a CloudFront distribution pointing to S3
3. Create a CodeBuild project with:
   - Source: Your Git repo
   - Buildspec: Use `game/buildspec.yml`
   - Environment variables:
     - `S3_BUCKET`: Your S3 bucket name
     - `CLOUDFRONT_DIST_ID`: Your CloudFront distribution ID
     - `OPENAI_API_KEY`: Your OpenAI API key

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for the chat assistant |

**Note:** Never commit API keys to git. Always use environment variables in your deployment platform.

## Local Development

```bash
# Uses .env from parent directory automatically
cd game
npm run dev
```

## Testing Production Build

```bash
cd game
npm run build:preview
# Opens at http://localhost:3001
```

