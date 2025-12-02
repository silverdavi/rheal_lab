#!/bin/bash
# Deploy script for Rheal Fertility Game to AWS Amplify
# Usage: ./deploy.sh

set -e

APP_ID="d2154hyy350f61"
BRANCH="main"
PROFILE="AdministratorAccess-302249171798"
REGION="us-east-1"

echo "🔧 Setting up Node 20..."
source ~/.nvm/nvm.sh
nvm use 20

echo "📦 Building..."
npm run build

echo "📁 Creating deployment package..."
cd dist
zip -r ../deploy.zip .
cd ..

echo "🚀 Creating deployment..."
DEPLOY_RESULT=$(aws amplify create-deployment \
  --app-id $APP_ID \
  --branch-name $BRANCH \
  --profile $PROFILE \
  --region $REGION)

JOB_ID=$(echo $DEPLOY_RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['jobId'])")
UPLOAD_URL=$(echo $DEPLOY_RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['zipUploadUrl'])")

echo "📤 Uploading build..."
curl -s -T deploy.zip "$UPLOAD_URL"

echo "▶️  Starting deployment..."
aws amplify start-deployment \
  --app-id $APP_ID \
  --branch-name $BRANCH \
  --job-id $JOB_ID \
  --profile $PROFILE \
  --region $REGION

echo "⏳ Waiting for deployment..."
sleep 5

STATUS=$(aws amplify get-job \
  --app-id $APP_ID \
  --branch-name $BRANCH \
  --job-id $JOB_ID \
  --profile $PROFILE \
  --region $REGION \
  --query 'job.summary.status' \
  --output text)

if [ "$STATUS" = "SUCCEED" ]; then
  echo ""
  echo "✅ Deployment successful!"
  echo ""
  echo "🌐 Live at:"
  echo "   https://rheal.me"
  echo "   https://www.rheal.me"
  echo "   https://main.d2154hyy350f61.amplifyapp.com"
else
  echo "⚠️  Deployment status: $STATUS"
  echo "Check AWS Console for details."
fi

# Cleanup
rm -f deploy.zip

echo "Done!"

