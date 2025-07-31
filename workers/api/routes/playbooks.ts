import { CloudflareEnv, ApiResponse, Playbook, PlaybookStep, UserProgress, StepProgress, CreatePlaybookRequest } from '../../../types';
import { nanoid } from 'nanoid';

interface RequestWithAuth extends Request {
  user?: any;
  organizationId?: string;
  params?: Record<string, string>;
}

export const playbookRoutes = {
  // List playbooks for organization
  async list(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const isActive = url.searchParams.get('active');
      
      const playbooksData = await env.ONBOARDING_KV.get(`playbooks:org:${request.organizationId}`);
      
      if (!playbooksData) {
        return new Response(JSON.stringify({
          success: true,
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            hasMore: false
          }
        } as ApiResponse), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookIds: string[] = JSON.parse(playbooksData);
      const playbooks: Playbook[] = [];
      
      // Fetch all playbooks
      for (const id of playbookIds) {
        const playbookData = await env.ONBOARDING_KV.get(`playbook:${id}`);
        if (playbookData) {
          const playbook: Playbook = JSON.parse(playbookData);
          
          // Filter by active status if specified
          if (isActive === null || playbook.isActive === (isActive === 'true')) {
            playbooks.push(playbook);
          }
        }
      }
      
      // Sort by creation date (newest first)
      playbooks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPlaybooks = playbooks.slice(startIndex, endIndex);
      
      return new Response(JSON.stringify({
        success: true,
        data: paginatedPlaybooks,
        meta: {
          total: playbooks.length,
          page,
          limit,
          hasMore: endIndex < playbooks.length
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('List playbooks error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch playbooks'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Create new playbook
  async create(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const body: CreatePlaybookRequest = await request.json();
      
      // Validate required fields
      if (!body.name || !body.description) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name and description are required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookId = nanoid();
      const now = new Date().toISOString();
      
      // Process steps and assign IDs
      const steps: PlaybookStep[] = body.steps.map((step, index) => ({
        ...step,
        id: nanoid(),
        order: index
      }));
      
      const playbook: Playbook = {
        id: playbookId,
        organizationId: request.organizationId!,
        name: body.name,
        description: body.description,
        version: '1.0.0',
        isActive: body.isActive ?? true,
        steps,
        secrets: [],
        githubRepos: body.githubRepos || [],
        createdBy: request.user.id,
        createdAt: now,
        updatedAt: now,
        analytics: {
          totalStarts: 0,
          completions: 0,
          commonBlockers: [],
          lastUpdated: now
        }
      };
      
      // Get existing playbook list for organization
      const playbooksData = await env.ONBOARDING_KV.get(`playbooks:org:${request.organizationId}`);
      const playbookIds: string[] = playbooksData ? JSON.parse(playbooksData) : [];
      
      // Add new playbook ID
      playbookIds.push(playbookId);
      
      // Store playbook and update list
      await Promise.all([
        env.ONBOARDING_KV.put(`playbook:${playbookId}`, JSON.stringify(playbook)),
        env.ONBOARDING_KV.put(`playbooks:org:${request.organizationId}`, JSON.stringify(playbookIds))
      ]);
      
      return new Response(JSON.stringify({
        success: true,
        data: playbook
      } as ApiResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Create playbook error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create playbook'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get specific playbook
  async get(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const playbookId = request.params?.id;
      
      if (!playbookId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Playbook ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookData = await env.ONBOARDING_KV.get(`playbook:${playbookId}`);
      
      if (!playbookData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Playbook not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbook: Playbook = JSON.parse(playbookData);
      
      // Check organization access
      if (playbook.organizationId !== request.organizationId) {
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
      
      // Get user progress if exists
      const progressData = await env.ONBOARDING_KV.get(`progress:${request.user.id}:${playbookId}`);
      const userProgress: UserProgress | null = progressData ? JSON.parse(progressData) : null;
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          ...playbook,
          userProgress
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Get playbook error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch playbook'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update playbook
  async update(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const playbookId = request.params?.id;
      const body = await request.json();
      
      if (!playbookId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Playbook ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookData = await env.ONBOARDING_KV.get(`playbook:${playbookId}`);
      
      if (!playbookData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Playbook not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbook: Playbook = JSON.parse(playbookData);
      
      // Check organization access
      if (playbook.organizationId !== request.organizationId) {
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
      
      // Update fields
      const updatedPlaybook: Playbook = {
        ...playbook,
        ...body,
        id: playbookId, // Ensure ID cannot be changed
        organizationId: playbook.organizationId, // Ensure org cannot be changed
        updatedAt: new Date().toISOString()
      };
      
      // If steps are updated, assign IDs to new steps
      if (body.steps) {
        updatedPlaybook.steps = body.steps.map((step: any, index: number) => ({
          ...step,
          id: step.id || nanoid(),
          order: index
        }));
      }
      
      await env.ONBOARDING_KV.put(`playbook:${playbookId}`, JSON.stringify(updatedPlaybook));
      
      return new Response(JSON.stringify({
        success: true,
        data: updatedPlaybook
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Update playbook error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update playbook'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Delete playbook
  async delete(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const playbookId = request.params?.id;
      
      if (!playbookId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Playbook ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookData = await env.ONBOARDING_KV.get(`playbook:${playbookId}`);
      
      if (!playbookData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Playbook not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbook: Playbook = JSON.parse(playbookData);
      
      // Check organization access
      if (playbook.organizationId !== request.organizationId) {
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
      
      // Remove from organization's playbook list
      const playbooksData = await env.ONBOARDING_KV.get(`playbooks:org:${request.organizationId}`);
      if (playbooksData) {
        const playbookIds: string[] = JSON.parse(playbooksData);
        const updatedIds = playbookIds.filter(id => id !== playbookId);
        await env.ONBOARDING_KV.put(`playbooks:org:${request.organizationId}`, JSON.stringify(updatedIds));
      }
      
      // Delete the playbook
      await env.ONBOARDING_KV.delete(`playbook:${playbookId}`);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          message: 'Playbook deleted successfully'
        }
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Delete playbook error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete playbook'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Start playbook for user
  async start(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const playbookId = request.params?.id;
      
      if (!playbookId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Playbook ID is required'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbookData = await env.ONBOARDING_KV.get(`playbook:${playbookId}`);
      
      if (!playbookData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Playbook not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const playbook: Playbook = JSON.parse(playbookData);
      
      // Check if playbook is active
      if (!playbook.isActive) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'PLAYBOOK_INACTIVE',
            message: 'This playbook is not active'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if user already has progress
      const existingProgressData = await env.ONBOARDING_KV.get(`progress:${request.user.id}:${playbookId}`);
      
      if (existingProgressData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'ALREADY_STARTED',
            message: 'User has already started this playbook'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const now = new Date().toISOString();
      const firstStep = playbook.steps.find(step => step.prerequisites.length === 0);
      
      // Create user progress
      const userProgress: UserProgress = {
        userId: request.user.id,
        playbookId,
        organizationId: request.organizationId!,
        status: 'in_progress',
        currentStepId: firstStep?.id,
        completedSteps: [],
        startedAt: now,
        totalTimeSpent: 0,
        notes: ''
      };
      
      // Update analytics
      playbook.analytics.totalStarts += 1;
      playbook.analytics.lastUpdated = now;
      
      // Store progress and update playbook
      await Promise.all([
        env.ONBOARDING_KV.put(`progress:${request.user.id}:${playbookId}`, JSON.stringify(userProgress)),
        env.ONBOARDING_KV.put(`playbook:${playbookId}`, JSON.stringify(playbook))
      ]);
      
      return new Response(JSON.stringify({
        success: true,
        data: userProgress
      } as ApiResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Start playbook error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'START_ERROR',
          message: 'Failed to start playbook'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Complete a step
  async completeStep(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const { id: playbookId, stepId } = request.params!;
      const body = await request.json();
      
      const progressData = await env.ONBOARDING_KV.get(`progress:${request.user.id}:${playbookId}`);
      
      if (!progressData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User progress not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const userProgress: UserProgress = JSON.parse(progressData);
      const now = new Date().toISOString();
      
      // Find existing step progress or create new
      let stepProgress = userProgress.completedSteps.find(step => step.stepId === stepId);
      
      if (!stepProgress) {
        stepProgress = {
          stepId,
          status: 'completed',
          startedAt: now,
          completedAt: now,
          timeSpent: 0,
          notes: body.notes || '',
          verificationData: body.verificationData || {}
        };
        userProgress.completedSteps.push(stepProgress);
      } else {
        stepProgress.status = 'completed';
        stepProgress.completedAt = now;
        stepProgress.notes = body.notes || stepProgress.notes;
        stepProgress.verificationData = body.verificationData || stepProgress.verificationData;
      }
      
      // Update current step to next available step
      const playbookData = await env.ONBOARDING_KV.get(`playbook:${playbookId}`);
      if (playbookData) {
        const playbook: Playbook = JSON.parse(playbookData);
        const completedStepIds = userProgress.completedSteps
          .filter(step => step.status === 'completed')
          .map(step => step.stepId);
        
        // Find next available step
        const nextStep = playbook.steps.find(step => 
          !completedStepIds.includes(step.id) &&
          step.prerequisites.every(prereq => completedStepIds.includes(prereq))
        );
        
        userProgress.currentStepId = nextStep?.id;
        
        // Check if all steps are completed
        if (!nextStep) {
          userProgress.status = 'completed';
          userProgress.completedAt = now;
          
          // Update playbook analytics
          playbook.analytics.completions += 1;
          playbook.analytics.lastUpdated = now;
          
          await env.ONBOARDING_KV.put(`playbook:${playbookId}`, JSON.stringify(playbook));
        }
      }
      
      await env.ONBOARDING_KV.put(`progress:${request.user.id}:${playbookId}`, JSON.stringify(userProgress));
      
      return new Response(JSON.stringify({
        success: true,
        data: userProgress
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Complete step error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'COMPLETE_ERROR',
          message: 'Failed to complete step'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Block on a step
  async blockStep(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const { id: playbookId, stepId } = request.params!;
      const body = await request.json();
      
      const progressData = await env.ONBOARDING_KV.get(`progress:${request.user.id}:${playbookId}`);
      
      if (!progressData) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User progress not found'
          }
        } as ApiResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const userProgress: UserProgress = JSON.parse(progressData);
      const now = new Date().toISOString();
      
      // Update user progress status
      userProgress.status = 'blocked';
      userProgress.currentStepId = stepId;
      
      // Find or create step progress
      let stepProgress = userProgress.completedSteps.find(step => step.stepId === stepId);
      
      if (!stepProgress) {
        stepProgress = {
          stepId,
          status: 'blocked',
          startedAt: now,
          timeSpent: 0,
          blockerReason: body.reason || 'User reported being blocked'
        };
        userProgress.completedSteps.push(stepProgress);
      } else {
        stepProgress.status = 'blocked';
        stepProgress.blockerReason = body.reason || 'User reported being blocked';
      }
      
      await env.ONBOARDING_KV.put(`progress:${request.user.id}:${playbookId}`, JSON.stringify(userProgress));
      
      return new Response(JSON.stringify({
        success: true,
        data: userProgress
      } as ApiResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Block step error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'BLOCK_ERROR',
          message: 'Failed to block step'
        }
      } as ApiResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Add step to playbook (stub for other operations)
  async addStep(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Add step functionality not implemented'
      }
    } as ApiResponse), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async updateStep(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Update step functionality not implemented'
      }
    } as ApiResponse), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async deleteStep(request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Delete step functionality not implemented'
      }
    } as ApiResponse), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};