import { CloudflareEnv, ApiResponse, User, Organization } from '../../../types';
import { generateJWT, verifyJWT } from '../utils/auth';
import { nanoid } from 'nanoid';

interface RequestWithAuth extends Request {
  user?: User;
  organizationId?: string;
  params?: Record<string, string>;
}

class GitHubAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

export const authRoutes = {
  // Initiate GitHub OAuth login
  async login(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const redirectUri = url.searchParams.get('redirect_uri') || 'https://your-app.pages.dev/auth/callback';
      
      // Generate state parameter for CSRF protection
      const state = nanoid(32);
      
      // Store state in KV with short expiration
      await env.ONBOARDING_KV.put(`auth_state:${state}`, JSON.stringify({
        redirectUri,
        timestamp: Date.now()
      }), {
        expirationTtl: 600 // 10 minutes
      });
      
      const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
      githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
      githubAuthUrl.searchParams.set('scope', 'user:email read:org');
      githubAuthUrl.searchParams.set('state', state);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          authUrl: githubAuthUrl.toString(),
          state
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Login error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Failed to initiate authentication'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Handle GitHub OAuth callback
  async callback(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const body = await request.json();
      const { code, state } = body;
      
      if (!code || !state) {
        throw new GitHubAuthError('Missing code or state parameter', 'INVALID_REQUEST');
      }
      
      // Verify state parameter
      const stateData = await env.ONBOARDING_KV.get(`auth_state:${state}`);
      if (!stateData) {
        throw new GitHubAuthError('Invalid or expired state parameter', 'INVALID_STATE');
      }
      
      // Clean up state
      await env.ONBOARDING_KV.delete(`auth_state:${state}`);
      
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      
      if (!tokenResponse.ok) {
        throw new GitHubAuthError('Failed to exchange code for token', 'TOKEN_EXCHANGE_FAILED');
      }
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new GitHubAuthError(tokenData.error_description || 'Token exchange failed', 'TOKEN_EXCHANGE_FAILED');
      }
      
      const accessToken = tokenData.access_token;
      
      // Get user information from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (!userResponse.ok) {
        throw new GitHubAuthError('Failed to fetch user information', 'USER_FETCH_FAILED');
      }
      
      const githubUser = await userResponse.json();
      
      // Get user email if not public
      let email = githubUser.email;
      if (!email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        
        if (emailResponse.ok) {
          const emails = await emailResponse.json();
          const primaryEmail = emails.find((e: any) => e.primary);
          email = primaryEmail?.email || emails[0]?.email;
        }
      }
      
      if (!email) {
        throw new GitHubAuthError('Unable to retrieve email address', 'EMAIL_REQUIRED');
      }
      
      // Check if user exists
      const existingUserData = await env.ONBOARDING_KV.get(`user_email:${email}`);
      let user: User;
      
      if (existingUserData) {
        // Update existing user
        const existingUserId = JSON.parse(existingUserData).userId;
        const userData = await env.ONBOARDING_KV.get(`user:${existingUserId}`);
        
        if (!userData) {
          throw new GitHubAuthError('User data inconsistency', 'DATA_ERROR');
        }
        
        user = JSON.parse(userData);
        user.githubId = githubUser.id.toString();
        user.githubUsername = githubUser.login;
        user.avatar = githubUser.avatar_url;
        user.lastLoginAt = new Date().toISOString();
        
        // Update user in KV
        await env.ONBOARDING_KV.put(`user:${user.id}`, JSON.stringify(user));
      } else {
        // Create new user
        const userId = nanoid();
        const organizationId = nanoid(); // Create default organization for new users
        
        // Create organization first
        const organization: Organization = {
          id: organizationId,
          name: `${githubUser.name || githubUser.login}'s Organization`,
          slug: `${githubUser.login}-${nanoid(8)}`.toLowerCase(),
          githubOrg: githubUser.company || undefined,
          settings: {
            allowGithubSync: true,
            requireMFA: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Create user
        user = {
          id: userId,
          email,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
          githubId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          role: 'admin', // First user is admin
          organizationId,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        
        // Store in KV
        await Promise.all([
          env.ONBOARDING_KV.put(`org:${organizationId}`, JSON.stringify(organization)),
          env.ONBOARDING_KV.put(`org_slug:${organization.slug}`, JSON.stringify({ organizationId })),
          env.ONBOARDING_KV.put(`user:${userId}`, JSON.stringify(user)),
          env.ONBOARDING_KV.put(`user_email:${email}`, JSON.stringify({ userId })),
          env.ONBOARDING_KV.put(`users:org:${organizationId}`, JSON.stringify([userId])),
        ]);
      }
      
      // Generate JWT token
      const token = await generateJWT({
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
      }, env.JWT_SECRET);
      
      // Generate refresh token
      const refreshToken = nanoid(64);
      
      // Store refresh token
      await env.ONBOARDING_KV.put(`refresh_token:${refreshToken}`, JSON.stringify({
        userId: user.id,
        createdAt: Date.now(),
      }), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 days
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            organizationId: user.organizationId,
          },
          token,
          refreshToken,
          expiresIn: 3600 // 1 hour
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Callback error:', error);
      
      if (error instanceof GitHubAuthError) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Refresh JWT token
  async refresh(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const body = await request.json();
      const { refreshToken } = body;
      
      if (!refreshToken) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get refresh token data
      const tokenData = await env.ONBOARDING_KV.get(`refresh_token:${refreshToken}`);
      
      if (!tokenData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token'
          }
        } as ApiResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const { userId } = JSON.parse(tokenData);
      
      // Get user
      const userData = await env.ONBOARDING_KV.get(`user:${userId}`);
      
      if (!userData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const user: User = JSON.parse(userData);
      
      // Generate new JWT token
      const token = await generateJWT({
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
      }, env.JWT_SECRET);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          expiresIn: 3600 // 1 hour
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Refresh error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Failed to refresh token'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Logout (invalidate refresh token)
  async logout(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const body = await request.json();
      const { refreshToken } = body;
      
      if (refreshToken) {
        // Delete refresh token
        await env.ONBOARDING_KV.delete(`refresh_token:${refreshToken}`);
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Logout error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Failed to logout'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};