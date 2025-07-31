#!/bin/bash

# DevOnboard Deployment Script
# This script deploys both the Cloudflare Workers API and the Next.js frontend to Cloudflare Pages

set -e

echo "🚀 Starting DevOnboard deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if we're logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_error "You're not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

# Check for required environment variables
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    print_warning "No environment file found. Make sure you have the required environment variables set."
    print_warning "Copy .env.example to .env.local and fill in your values."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Create KV namespaces if they don't exist
print_status "Setting up KV namespaces..."

# Check if KV namespaces exist, create if not
ONBOARDING_KV_ID=$(wrangler kv:namespace list | grep "onboarding-kv" | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")
SECRETS_KV_ID=$(wrangler kv:namespace list | grep "secrets-kv" | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$ONBOARDING_KV_ID" ]; then
    print_status "Creating onboarding KV namespace..."
    ONBOARDING_KV_OUTPUT=$(wrangler kv:namespace create "onboarding-kv")
    ONBOARDING_KV_ID=$(echo "$ONBOARDING_KV_OUTPUT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_status "Created onboarding KV namespace with ID: $ONBOARDING_KV_ID"
fi

if [ -z "$SECRETS_KV_ID" ]; then
    print_status "Creating secrets KV namespace..."
    SECRETS_KV_OUTPUT=$(wrangler kv:namespace create "secrets-kv")
    SECRETS_KV_ID=$(echo "$SECRETS_KV_OUTPUT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_status "Created secrets KV namespace with ID: $SECRETS_KV_ID"
fi

# Update wrangler.toml with KV namespace IDs
print_status "Updating wrangler.toml with KV namespace IDs..."
sed -i.backup "s/your-kv-namespace-id/$ONBOARDING_KV_ID/g" wrangler.toml
sed -i.backup "s/your-secrets-kv-namespace-id/$SECRETS_KV_ID/g" wrangler.toml

# Deploy Cloudflare Worker
print_status "Deploying Cloudflare Workers API..."
wrangler deploy

# Get the worker URL
WORKER_URL=$(wrangler whoami 2>/dev/null | grep -o 'https://[^/]*\.workers\.dev' || echo "https://dev-onboarding-api.your-subdomain.workers.dev")

print_status "Worker deployed to: $WORKER_URL"

# Build the Next.js application
print_status "Building Next.js application..."
export NEXT_PUBLIC_API_URL="$WORKER_URL"
npm run build

# Deploy to Cloudflare Pages
if command -v wrangler pages &> /dev/null; then
    print_status "Deploying to Cloudflare Pages..."
    
    # Try to deploy using wrangler pages
    if wrangler pages deploy out --project-name="dev-onboarding-frontend" --compatibility-date="2024-01-01"; then
        print_status "✅ Successfully deployed to Cloudflare Pages!"
    else
        print_warning "Cloudflare Pages deployment failed. You may need to create the project first:"
        echo "1. Go to https://dash.cloudflare.com/pages"
        echo "2. Create a new project named 'dev-onboarding-frontend'"
        echo "3. Set build command: 'npm run build'"
        echo "4. Set build output directory: 'out'"
        echo "5. Set environment variable: NEXT_PUBLIC_API_URL=$WORKER_URL"
        echo ""
        echo "Or manually upload the 'out' directory to Cloudflare Pages."
    fi
else
    print_warning "Cloudflare Pages CLI not available. Manual deployment required:"
    echo "1. Go to https://dash.cloudflare.com/pages"
    echo "2. Create a new project"
    echo "3. Upload the 'out' directory"
    echo "4. Set environment variable: NEXT_PUBLIC_API_URL=$WORKER_URL"
fi

# Provide next steps
echo ""
print_status "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set up your secrets using wrangler:"
echo "   wrangler secret put JWT_SECRET"
echo "   wrangler secret put GITHUB_CLIENT_SECRET"
echo "   wrangler secret put ENCRYPTION_KEY"
echo "   wrangler secret put WEBHOOK_SECRET"
echo ""
echo "2. Update your GitHub OAuth App settings:"
echo "   - Authorization callback URL: https://your-pages-url.pages.dev/login"
echo "   - Homepage URL: https://your-pages-url.pages.dev"
echo ""
echo "3. Test your deployment:"
echo "   - API Health: $WORKER_URL/health"
echo "   - Frontend: https://your-pages-url.pages.dev"
echo ""
print_status "Happy onboarding! 🚀"