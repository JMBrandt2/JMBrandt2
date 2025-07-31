import { CloudflareEnv, ApiResponse, Organization, User, InviteUserRequest } from '../../../types';
import { nanoid } from 'nanoid';

interface RequestWithAuth extends Request {
  user?: User;
  organizationId?: string;
  params?: Record<string, string>;
}

export const organizationRoutes = {
  // Create new organization
  async create(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const body = await request.json();
      const { name, slug } = body;
      
      if (!name) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Organization name is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const organizationId = nanoid();
      const now = new Date().toISOString();
      
      const organization: Organization = {
        id: organizationId,
        name,
        slug: slug || `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${nanoid(8)}`,
        settings: {
          allowGithubSync: true,
          requireMFA: false,
        },
        createdAt: now,
        updatedAt: now,
      };
      
      // Check if slug is already taken
      const existingOrgData = await env.ONBOARDING_KV.get(`org_slug:${organization.slug}`);
      if (existingOrgData) {
        organization.slug = `${organization.slug}-${nanoid(4)}`;
      }
      
      await Promise.all([
        env.ONBOARDING_KV.put(`org:${organizationId}`, JSON.stringify(organization)),
        env.ONBOARDING_KV.put(`org_slug:${organization.slug}`, JSON.stringify({ organizationId })),
        env.ONBOARDING_KV.put(`users:org:${organizationId}`, JSON.stringify([])),
        env.ONBOARDING_KV.put(`playbooks:org:${organizationId}`, JSON.stringify([])),
        env.ONBOARDING_KV.put(`docs:org:${organizationId}`, JSON.stringify([])),
        env.ONBOARDING_KV.put(`secrets:org:${organizationId}`, JSON.stringify([]))
      ]);
      
      return new Response(JSON.stringify({
        success: true,
        data: organization
      } as ApiResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Create organization error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create organization'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get organization details
  async get(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const organizationId = request.params?.id;
      
      if (!organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Organization ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check access
      if (request.user!.role !== 'admin' && request.user!.organizationId !== organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        } as ApiResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const organizationData = await env.ONBOARDING_KV.get(`org:${organizationId}`);
      
      if (!organizationData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const organization: Organization = JSON.parse(organizationData);
      
      return new Response(JSON.stringify({
        success: true,
        data: organization
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Get organization error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch organization'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update organization
  async update(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const organizationId = request.params?.id;
      const body = await request.json();
      
      if (!organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Organization ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check access
      if (request.user!.role !== 'admin' && request.user!.organizationId !== organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        } as ApiResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const organizationData = await env.ONBOARDING_KV.get(`org:${organizationId}`);
      
      if (!organizationData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const organization: Organization = JSON.parse(organizationData);
      
      // Update fields
      const updatedOrganization: Organization = {
        ...organization,
        ...body,
        id: organizationId, // Ensure ID cannot be changed
        updatedAt: new Date().toISOString()
      };
      
      await env.ONBOARDING_KV.put(`org:${organizationId}`, JSON.stringify(updatedOrganization));
      
      return new Response(JSON.stringify({
        success: true,
        data: updatedOrganization
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Update organization error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update organization'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get organization users
  async getUsers(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const organizationId = request.params?.id;
      
      if (!organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Organization ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check access
      if (request.user!.role !== 'admin' && request.user!.organizationId !== organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        } as ApiResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const usersData = await env.ONBOARDING_KV.get(`users:org:${organizationId}`);
      
      if (!usersData) {
        return new Response(JSON.stringify({
          success: true,
          data: []
        } as ApiResponse), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const userIds: string[] = JSON.parse(usersData);
      const users: Array<Pick<User, 'id' | 'email' | 'name' | 'avatar' | 'role' | 'createdAt' | 'lastLoginAt'>> = [];
      
      // Fetch user details
      for (const userId of userIds) {
        const userData = await env.ONBOARDING_KV.get(`user:${userId}`);
        if (userData) {
          const user: User = JSON.parse(userData);
          users.push({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
          });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: users
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Get organization users error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch organization users'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Invite user to organization
  async inviteUser(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const organizationId = request.params?.id;
      const body: InviteUserRequest = await request.json();
      
      if (!organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Organization ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check access (only admins can invite)
      if (request.user!.role !== 'admin' && request.user!.organizationId !== organizationId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admins can invite users'
          }
        } as ApiResponse), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const { email, role = 'user', playbookId } = body;
      
      if (!email) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if user already exists
      const existingUserData = await env.ONBOARDING_KV.get(`user_email:${email}`);
      if (existingUserData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Create invitation token
      const inviteToken = nanoid(64);
      const inviteData = {
        email,
        role,
        organizationId,
        playbookId,
        invitedBy: request.user!.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };
      
      // Store invitation
      await env.ONBOARDING_KV.put(`invite:${inviteToken}`, JSON.stringify(inviteData), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });
      
      // TODO: Send email invitation (implement email service)
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          inviteToken,
          email,
          role,
          expiresAt: inviteData.expiresAt,
          inviteUrl: `${new URL(request.url).origin}/invite/${inviteToken}`
        }
      } as ApiResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Invite user error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INVITE_ERROR',
          message: 'Failed to invite user'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};