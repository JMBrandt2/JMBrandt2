import { CloudflareEnv, ApiResponse, User } from '../../../types';
import { verifyJWT } from '../utils/auth';

interface RequestWithAuth extends Request {
  user?: User;
  organizationId?: string;
  params?: Record<string, string>;
}

// CORS middleware
export function cors(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  const method = request.method;

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return null;
}

// Authentication middleware
export function withAuth(
  handler: (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext) => Promise<Response>
) {
  return async (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return unauthorizedResponse('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, env.JWT_SECRET);
      
      if (!payload || !payload.userId) {
        return unauthorizedResponse('Invalid token');
      }

      // Get user from KV store
      const userKey = `user:${payload.userId}`;
      const userData = await env.ONBOARDING_KV.get(userKey);
      
      if (!userData) {
        return unauthorizedResponse('User not found');
      }

      const user: User = JSON.parse(userData);
      
      // Check if user is active
      if (!user.organizationId) {
        return unauthorizedResponse('User not associated with an organization');
      }

      // Add user and organization info to request
      request.user = user;
      request.organizationId = user.organizationId;

      return handler(request, env, ctx);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return unauthorizedResponse('Authentication failed');
    }
  };
}

// Rate limiting middleware
export function rateLimiter(
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  return async (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> => {
    try {
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                      request.headers.get('X-Forwarded-For') || 
                      'unknown';
      
      const key = `rate_limit:${clientIP}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get current request count
      const currentData = await env.ONBOARDING_KV.get(key);
      let requests: number[] = currentData ? JSON.parse(currentData) : [];
      
      // Remove old requests outside the window
      requests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit is exceeded
      if (requests.length >= maxRequests) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.'
          }
        } as ApiResponse), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(windowMs / 1000).toString()
          }
        });
      }
      
      // Add current request
      requests.push(now);
      
      // Store updated request list with TTL
      await env.ONBOARDING_KV.put(key, JSON.stringify(requests), {
        expirationTtl: Math.ceil(windowMs / 1000) + 10 // Add buffer
      });
      
      // Continue to next middleware/handler
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request through
      return new Response('OK', { status: 200 });
    }
  };
}

// Error handler
export function errorHandler(error: any): Response {
  console.error('API Error:', error);
  
  // Handle known error types
  if (error.name === 'ValidationError') {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: error.details || {}
      }
    } as ApiResponse), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (error.name === 'NotFoundError') {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error.message || 'Resource not found'
      }
    } as ApiResponse), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (error.name === 'ForbiddenError') {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: error.message || 'Access denied'
      }
    } as ApiResponse), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Generic server error
  return new Response(JSON.stringify({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred'
    }
  } as ApiResponse), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Helper function for unauthorized responses
function unauthorizedResponse(message: string): Response {
  return new Response(JSON.stringify({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message
    }
  } as ApiResponse), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Validation middleware
export function validateJSON(schema: any) {
  return async (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response | null> => {
    try {
      const contentType = request.headers.get('Content-Type');
      
      if (!contentType || !contentType.includes('application/json')) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Type must be application/json'
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const body = await request.json();
      const result = schema.safeParse(body);
      
      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: result.error.issues
          }
        } as ApiResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Add validated data to request
      (request as any).validatedData = result.data;
      return null;
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        }
      } as ApiResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

// Role-based access control middleware
export function requireRole(allowedRoles: string[]) {
  return async (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response | null> => {
    if (!request.user) {
      return unauthorizedResponse('Authentication required');
    }
    
    if (!allowedRoles.includes(request.user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      } as ApiResponse), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return null;
  };
}

// Organization access middleware
export function requireOrganizationAccess(paramName: string = 'id') {
  return async (request: RequestWithAuth, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response | null> => {
    if (!request.user || !request.params) {
      return unauthorizedResponse('Authentication required');
    }
    
    const resourceOrgId = request.params[paramName];
    
    if (request.user.role === 'admin') {
      return null; // Admins can access any organization
    }
    
    if (request.user.organizationId !== resourceOrgId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this organization'
        }
      } as ApiResponse), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return null;
  };
}