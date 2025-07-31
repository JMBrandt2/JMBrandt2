import { CloudflareEnv, ApiResponse } from '../../types';
import { authRoutes } from './routes/auth';
import { playbookRoutes } from './routes/playbooks';
import { userRoutes } from './routes/users';
import { organizationRoutes } from './routes/organizations';
import { secretRoutes } from './routes/secrets';
import { documentationRoutes } from './routes/documentation';
import { analyticsRoutes } from './routes/analytics';
import { githubRoutes } from './routes/github';
import { cors, withAuth, errorHandler, rateLimiter } from './middleware';
import { PlaybookState } from './durable-objects/PlaybookState';

export { PlaybookState };

interface RequestWithAuth extends Request {
  user?: any;
  organizationId?: string;
}

class Router {
  private routes: Map<string, Map<string, (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext) => Promise<Response>>> = new Map();

  constructor() {
    // Initialize HTTP methods
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(method => {
      this.routes.set(method, new Map());
    });
  }

  register(method: string, path: string, handler: (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext) => Promise<Response>) {
    const methodRoutes = this.routes.get(method);
    if (methodRoutes) {
      methodRoutes.set(path, handler);
    }
  }

  async route(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) {
      return this.notFound();
    }

    // Exact match first
    const exactHandler = methodRoutes.get(path);
    if (exactHandler) {
      return exactHandler(request, env, ctx);
    }

    // Pattern matching for dynamic routes
    for (const [pattern, handler] of methodRoutes.entries()) {
      const match = this.matchPath(pattern, path);
      if (match) {
        // Add path parameters to request
        (request as any).params = match.params;
        return handler(request, env, ctx);
      }
    }

    return this.notFound();
  }

  private matchPath(pattern: string, path: string): { params: Record<string, string> } | null {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        const paramName = patternPart.slice(1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return { params };
  }

  private notFound(): Response {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      }
    } as ApiResponse), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Initialize router and register all routes
const router = new Router();

// Health check
router.register('GET', '/health', async () => {
  return new Response(JSON.stringify({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  } as ApiResponse), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Auth routes (public)
router.register('POST', '/auth/login', authRoutes.login);
router.register('POST', '/auth/callback', authRoutes.callback);
router.register('POST', '/auth/refresh', authRoutes.refresh);
router.register('POST', '/auth/logout', authRoutes.logout);

// Organization routes
router.register('POST', '/organizations', organizationRoutes.create);
router.register('GET', '/organizations/:id', withAuth(organizationRoutes.get));
router.register('PUT', '/organizations/:id', withAuth(organizationRoutes.update));
router.register('GET', '/organizations/:id/users', withAuth(organizationRoutes.getUsers));
router.register('POST', '/organizations/:id/invite', withAuth(organizationRoutes.inviteUser));

// User routes
router.register('GET', '/users/me', withAuth(userRoutes.getMe));
router.register('PUT', '/users/me', withAuth(userRoutes.updateMe));
router.register('GET', '/users/:id', withAuth(userRoutes.get));
router.register('GET', '/users/:id/progress', withAuth(userRoutes.getProgress));

// Playbook routes
router.register('GET', '/playbooks', withAuth(playbookRoutes.list));
router.register('POST', '/playbooks', withAuth(playbookRoutes.create));
router.register('GET', '/playbooks/:id', withAuth(playbookRoutes.get));
router.register('PUT', '/playbooks/:id', withAuth(playbookRoutes.update));
router.register('DELETE', '/playbooks/:id', withAuth(playbookRoutes.delete));
router.register('POST', '/playbooks/:id/steps', withAuth(playbookRoutes.addStep));
router.register('PUT', '/playbooks/:id/steps/:stepId', withAuth(playbookRoutes.updateStep));
router.register('DELETE', '/playbooks/:id/steps/:stepId', withAuth(playbookRoutes.deleteStep));

// Progress tracking routes
router.register('POST', '/playbooks/:id/start', withAuth(playbookRoutes.start));
router.register('POST', '/playbooks/:id/steps/:stepId/complete', withAuth(playbookRoutes.completeStep));
router.register('POST', '/playbooks/:id/steps/:stepId/block', withAuth(playbookRoutes.blockStep));

// Secret routes
router.register('GET', '/secrets', withAuth(secretRoutes.list));
router.register('POST', '/secrets', withAuth(secretRoutes.create));
router.register('GET', '/secrets/:id', withAuth(secretRoutes.get));
router.register('PUT', '/secrets/:id', withAuth(secretRoutes.update));
router.register('DELETE', '/secrets/:id', withAuth(secretRoutes.delete));
router.register('POST', '/secrets/:id/rotate', withAuth(secretRoutes.rotate));

// Documentation routes
router.register('GET', '/docs', withAuth(documentationRoutes.list));
router.register('POST', '/docs', withAuth(documentationRoutes.create));
router.register('GET', '/docs/:id', withAuth(documentationRoutes.get));
router.register('PUT', '/docs/:id', withAuth(documentationRoutes.update));
router.register('DELETE', '/docs/:id', withAuth(documentationRoutes.delete));
router.register('POST', '/docs/sync', withAuth(documentationRoutes.syncFromGitHub));

// Analytics routes
router.register('GET', '/analytics/overview', withAuth(analyticsRoutes.getOverview));
router.register('GET', '/analytics/playbooks/:id', withAuth(analyticsRoutes.getPlaybookAnalytics));
router.register('GET', '/analytics/users', withAuth(analyticsRoutes.getUserAnalytics));

// GitHub integration routes
router.register('POST', '/github/webhook', rateLimiter(githubRoutes.webhook));
router.register('POST', '/github/connect', withAuth(githubRoutes.connect));
router.register('GET', '/github/repos', withAuth(githubRoutes.getRepos));
router.register('POST', '/github/repos/:id/sync', withAuth(githubRoutes.syncRepo));

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      // Apply CORS middleware
      const corsResponse = cors(request);
      if (corsResponse) return corsResponse;

      // Apply rate limiting for non-authenticated routes
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/auth/') && !url.pathname.startsWith('/health')) {
        const rateLimitResponse = await rateLimiter()(request as RequestWithAuth, env, ctx);
        if (rateLimitResponse.status === 429) {
          return rateLimitResponse;
        }
      }

      // Route the request
      const response = await router.route(request as RequestWithAuth, env, ctx);
      
      // Add security headers
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('X-XSS-Protection', '1; mode=block');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      return errorHandler(error);
    }
  }
};