# DevOnboard - Developer Onboarding Platform MVP

A comprehensive developer onboarding platform built on Cloudflare's edge infrastructure. Streamline your team's onboarding process with interactive playbooks, live documentation, secure secrets management, and real-time analytics.

## 🌟 Features

- **Interactive Playbooks**: Step-by-step guided onboarding with progress tracking
- **Live Documentation**: Auto-synced docs from GitHub repositories  
- **Secure Secrets Management**: Safe distribution of API keys and credentials
- **Team Management**: Role-based access control and user invitations
- **Real-time Analytics**: Track progress and identify bottlenecks
- **GitHub Integration**: Seamless workflow integration with verification

## 🏗️ Architecture

- **Frontend**: Next.js with TypeScript, deployed on Cloudflare Pages
- **Backend**: Cloudflare Workers with TypeScript
- **Database**: Cloudflare KV for storage
- **Real-time**: Durable Objects for WebSocket connections
- **Authentication**: GitHub OAuth with JWT tokens
- **Security**: Encrypted secrets storage with access logging

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [GitHub OAuth App](https://github.com/settings/applications/new)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd dev-onboarding-mvp
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NEXT_PUBLIC_API_URL=https://your-worker.your-subdomain.workers.dev
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
```

### 3. GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Create a new OAuth App with:
   - **Homepage URL**: `https://your-app.pages.dev`
   - **Authorization callback URL**: `https://your-app.pages.dev/login`
3. Note the **Client ID** and **Client Secret**

### 4. Cloudflare Setup

```bash
# Login to Cloudflare
wrangler login

# Set up secrets
wrangler secret put JWT_SECRET
wrangler secret put GITHUB_CLIENT_SECRET  
wrangler secret put ENCRYPTION_KEY
wrangler secret put WEBHOOK_SECRET
```

### 5. Deploy Everything

```bash
./deploy.sh
```

The deployment script will:
- Create KV namespaces
- Deploy the Workers API
- Build and deploy the frontend to Pages
- Provide setup instructions

## 🛠️ Development

### Local Development

```bash
# Start the frontend
npm run dev

# In another terminal, start the worker
npm run worker:dev
```

### Project Structure

```
├── pages/                 # Next.js pages
├── components/           # React components
├── lib/                 # Utilities and hooks
├── styles/              # CSS and styling
├── workers/             # Cloudflare Workers
│   ├── api/            # API routes
│   └── durable-objects/ # Real-time state
├── types/               # TypeScript definitions
└── public/              # Static assets
```

### Key Components

- **Authentication**: GitHub OAuth with JWT tokens
- **API Routes**: RESTful API built on Cloudflare Workers
- **Real-time Updates**: WebSocket connections via Durable Objects
- **State Management**: React Context for auth and API calls
- **UI Components**: Tailwind CSS with custom design system

### Available Scripts

```bash
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run worker:dev   # Start worker development server
npm run worker:deploy # Deploy worker to Cloudflare
npm run pages:deploy # Deploy frontend to Pages
```

## 📦 Core Functionality

### Playbook Management

- Create interactive step-by-step onboarding guides
- Track user progress and completion rates
- Set prerequisites and dependencies between steps
- Support multiple verification methods (manual, GitHub, API)

### User Progress Tracking

- Real-time progress updates
- Step completion with time tracking
- Blocker identification and reporting
- Analytics for admin insights

### Secrets Management

- Encrypted storage of sensitive data
- Role-based access control
- Access logging and audit trails
- Integration with onboarding steps

### GitHub Integration

- Repository documentation sync
- PR/commit verification for steps
- Webhook support for real-time updates
- Automatic onboarding issue creation

## 🔒 Security

- GitHub OAuth for secure authentication
- JWT tokens with configurable expiration
- Encrypted secrets storage in KV
- RBAC for admin/user permissions
- Rate limiting on API endpoints
- CSRF protection with state parameters

## 📊 Analytics

Track key metrics:
- Onboarding completion rates
- Average time to complete steps
- Common bottlenecks and blockers
- User engagement and satisfaction
- Step-by-step analytics

## 🌐 Deployment

### Automated Deployment

Use the included deployment script:

```bash
./deploy.sh
```

### Manual Deployment

1. **Deploy Workers API**:
   ```bash
   wrangler deploy
   ```

2. **Build and Deploy Frontend**:
   ```bash
   npm run build
   wrangler pages deploy out --project-name="dev-onboarding-frontend"
   ```

### Production Configuration

1. Set up custom domains in Cloudflare
2. Configure GitHub OAuth with production URLs
3. Set up monitoring and alerting
4. Enable Cloudflare security features

## 🔧 Configuration

### Worker Environment Variables

Set via `wrangler secret put`:

- `JWT_SECRET`: 256-bit secret for JWT signing
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret
- `ENCRYPTION_KEY`: 256-bit key for secrets encryption
- `WEBHOOK_SECRET`: Secret for GitHub webhook verification

### Frontend Environment Variables

Set in Cloudflare Pages or `.env.local`:

- `NEXT_PUBLIC_API_URL`: Worker API URL
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`: GitHub OAuth client ID

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 API Documentation

### Authentication

All API requests (except auth endpoints) require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### Core Endpoints

- `GET /health` - API health check
- `POST /auth/login` - Initiate GitHub OAuth
- `POST /auth/callback` - Handle OAuth callback
- `GET /playbooks` - List organization playbooks
- `POST /playbooks` - Create new playbook
- `GET /playbooks/:id` - Get playbook details
- `POST /playbooks/:id/start` - Start playbook for user
- `POST /playbooks/:id/steps/:stepId/complete` - Complete step

## 🆘 Troubleshooting

### Common Issues

1. **Worker deployment fails**: Check wrangler authentication and permissions
2. **GitHub OAuth errors**: Verify client ID/secret and callback URLs
3. **KV namespace errors**: Ensure namespaces are created and IDs are correct
4. **Frontend build fails**: Check Node.js version and dependency installation

### Debug Mode

Enable verbose logging:

```bash
export DEBUG=true
wrangler dev --local
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- UI powered by [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Heroicons](https://heroicons.com/)
- Authentication via [GitHub OAuth](https://docs.github.com/en/developers/apps/building-oauth-apps)

---

**Built with ❤️ for the developer community**

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-username/dev-onboarding-mvp).
