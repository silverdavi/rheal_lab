#!/bin/bash
# Ship script - git commit, push, deploy, and verify
# Usage: ./ship.sh "commit message"
#    or: ./ship.sh (will prompt for message)

set -e

APP_ID="d2154hyy350f61"
BRANCH="main"
PROFILE="AdministratorAccess-302249171798"
REGION="us-east-1"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 SHIP IT!${NC}"
echo ""

# Get commit message
if [ -n "$1" ]; then
  COMMIT_MSG="$1"
else
  echo -e "${YELLOW}Enter commit message:${NC}"
  read -r COMMIT_MSG
  if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Update game"
  fi
fi

# Git operations
echo -e "${BLUE}📝 Git: Adding all changes...${NC}"
cd "$(dirname "$0")/.."
git add -A

echo -e "${BLUE}📝 Git: Committing...${NC}"
if git diff --cached --quiet; then
  echo -e "${YELLOW}No changes to commit${NC}"
else
  git commit -m "$COMMIT_MSG"
fi

echo -e "${BLUE}📝 Git: Pushing to origin...${NC}"
git push

echo ""
echo -e "${GREEN}✓ Git complete${NC}"
echo ""

# Deploy
cd game
echo -e "${BLUE}🔧 Setting up Node 20...${NC}"
source ~/.nvm/nvm.sh
nvm use 20

echo -e "${BLUE}📦 Building...${NC}"
npm run build 2>&1 | tail -5

echo -e "${BLUE}📁 Creating deployment package...${NC}"
cd dist
zip -r ../deploy.zip . > /dev/null
cd ..

echo -e "${BLUE}🚀 Creating deployment...${NC}"
DEPLOY_RESULT=$(aws amplify create-deployment \
  --app-id $APP_ID \
  --branch-name $BRANCH \
  --profile $PROFILE \
  --region $REGION 2>/dev/null)

JOB_ID=$(echo $DEPLOY_RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['jobId'])")
UPLOAD_URL=$(echo $DEPLOY_RESULT | python3 -c "import sys, json; print(json.load(sys.stdin)['zipUploadUrl'])")

echo -e "${BLUE}📤 Uploading build...${NC}"
curl -s -T deploy.zip "$UPLOAD_URL" > /dev/null

echo -e "${BLUE}▶️  Starting deployment...${NC}"
aws amplify start-deployment \
  --app-id $APP_ID \
  --branch-name $BRANCH \
  --job-id $JOB_ID \
  --profile $PROFILE \
  --region $REGION > /dev/null

echo -e "${YELLOW}⏳ Waiting for deployment...${NC}"

# Poll for completion
for i in {1..30}; do
  sleep 2
  STATUS=$(aws amplify get-job \
    --app-id $APP_ID \
    --branch-name $BRANCH \
    --job-id $JOB_ID \
    --profile $PROFILE \
    --region $REGION \
    --query 'job.summary.status' \
    --output text 2>/dev/null)
  
  if [ "$STATUS" = "SUCCEED" ]; then
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
  fi
  echo -n "."
done
echo ""

# Cleanup
rm -f deploy.zip

if [ "$STATUS" = "SUCCEED" ]; then
  echo ""
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ SHIPPED!${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}"
  echo ""
  echo -e "🌐 ${BLUE}https://rheal.me${NC}"
  echo -e "🌐 ${BLUE}https://www.rheal.me${NC}"
  echo ""
else
  echo -e "${RED}⚠️  Deployment status: $STATUS${NC}"
fi

