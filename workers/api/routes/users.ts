import { CloudflareEnv, ApiResponse, User, UserProgress } from '../../../types';

interface RequestWithAuth extends Request {
  user?: User;
  organizationId?: string;
  params?: Record<string, string>;
}

export const userRoutes = {
  // Get current user profile
  async getMe(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: request.user!.id,
          email: request.user!.email,
          name: request.user!.name,
          avatar: request.user!.avatar,
          role: request.user!.role,
          organizationId: request.user!.organizationId,
          githubUsername: request.user!.githubUsername,
          createdAt: request.user!.createdAt,
          lastLoginAt: request.user!.lastLoginAt
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Get user error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch user data'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update current user profile
  async updateMe(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const body = await request.json();
      const { name, avatar } = body;
      
      // Update user data
      const updatedUser: User = {
        ...request.user!,
        name: name || request.user!.name,
        avatar: avatar || request.user!.avatar,
      };
      
      // Store updated user
      await env.ONBOARDING_KV.put(`user:${request.user!.id}`, JSON.stringify(updatedUser));
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          avatar: updatedUser.avatar,
          role: updatedUser.role,
          organizationId: updatedUser.organizationId,
          githubUsername: updatedUser.githubUsername,
          createdAt: updatedUser.createdAt,
          lastLoginAt: updatedUser.lastLoginAt
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Update user error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update user profile'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get user by ID (admin only)
  async get(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const userId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'User ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if current user can access this user
      if (request.user!.role !== 'admin' && request.user!.id !== userId) {
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
      
      const userData = await env.ONBOARDING_KV.get(`user:${userId}`);
      
      if (!userData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const user: User = JSON.parse(userData);
      
      // Check organization access for non-admin users
      if (request.user!.role !== 'admin' && user.organizationId !== request.organizationId) {
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
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          organizationId: user.organizationId,
          githubUsername: user.githubUsername,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch user'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get user progress across all playbooks
  async getProgress(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const userId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'User ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check access permissions
      if (request.user!.role !== 'admin' && request.user!.id !== userId) {
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
      
      // Get user to check organization
      const userData = await env.ONBOARDING_KV.get(`user:${userId}`);
      
      if (!userData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const user: User = JSON.parse(userData);
      
      // Check organization access for non-admin users
      if (request.user!.role !== 'admin' && user.organizationId !== request.organizationId) {
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
      
      // Get all playbooks for the user's organization
      const playbooksData = await env.ONBOARDING_KV.get(`playbooks:org:${user.organizationId}`);
      
      if (!playbooksData) {
        return new Response(JSON.stringify({
          success: true,
          data: []
        } as ApiResponse), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookIds: string[] = JSON.parse(playbooksData);
      const userProgressList: Array<UserProgress & { playbookName?: string }> = [];
      
      // Get progress for each playbook
      for (const playbookId of playbookIds) {
        const progressData = await env.ONBOARDING_KV.get(`progress:${userId}:${playbookId}`);
        
        if (progressData) {
          const progress: UserProgress = JSON.parse(progressData);
          
          // Get playbook name
          const playbookData = await env.ONBOARDING_KV.get(`playbook:${playbookId}`);
          if (playbookData) {
            const playbook = JSON.parse(playbookData);
            userProgressList.push({
              ...progress,
              playbookName: playbook.name
            });
          } else {
            userProgressList.push(progress);
          }
        }
      }
      
      // Sort by start date (newest first)
      userProgressList.sort((a, b) => {
        if (!a.startedAt || !b.startedAt) return 0;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: userProgressList
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Get user progress error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch user progress'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};