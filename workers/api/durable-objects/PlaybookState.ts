import { CloudflareEnv } from '../../../types';

export class PlaybookState {
  private state: DurableObjectState;
  private env: CloudflareEnv;
  private sessions: Map<string, WebSocket> = new Map();

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/connect':
        return this.handleWebSocketConnection(request);
      case '/broadcast':
        return this.handleBroadcast(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleWebSocketConnection(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const playbookId = url.searchParams.get('playbookId');

    if (!userId || !playbookId) {
      return new Response('Missing userId or playbookId', { status: 400 });
    }

    const sessionId = `${userId}:${playbookId}`;
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Store the session
    this.sessions.set(sessionId, server);

    // Handle incoming messages
    server.accept();
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleMessage(sessionId, data);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Clean up on close
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleMessage(sessionId: string, data: any): Promise<void> {
    const { type, payload } = data;

    switch (type) {
      case 'step_start':
        await this.handleStepStart(sessionId, payload);
        break;
      case 'step_complete':
        await this.handleStepComplete(sessionId, payload);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(sessionId);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  private async handleStepStart(sessionId: string, payload: any): Promise<void> {
    const { stepId, timestamp } = payload;
    
    // Store step start time
    await this.state.storage.put(`step_start:${sessionId}:${stepId}`, timestamp);
    
    // Broadcast to other sessions for this playbook
    this.broadcastToPlaybook(sessionId, {
      type: 'user_step_started',
      data: { sessionId, stepId, timestamp }
    });
  }

  private async handleStepComplete(sessionId: string, payload: any): Promise<void> {
    const { stepId, timestamp } = payload;
    
    // Get start time
    const startTime = await this.state.storage.get(`step_start:${sessionId}:${stepId}`);
    const timeSpent = startTime ? timestamp - startTime : 0;
    
    // Store completion
    await this.state.storage.put(`step_complete:${sessionId}:${stepId}`, {
      timestamp,
      timeSpent
    });
    
    // Clean up start time
    await this.state.storage.delete(`step_start:${sessionId}:${stepId}`);
    
    // Broadcast completion
    this.broadcastToPlaybook(sessionId, {
      type: 'user_step_completed',
      data: { sessionId, stepId, timestamp, timeSpent }
    });
  }

  private async handleHeartbeat(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.send(JSON.stringify({
        type: 'heartbeat_ack',
        timestamp: Date.now()
      }));
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const { type, data, playbookId } = await request.json();
      
      // Broadcast to all sessions for this playbook
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      
      for (const [sessionId, session] of this.sessions.entries()) {
        if (sessionId.includes(playbookId)) {
          session.send(message);
        }
      }
      
      return new Response(JSON.stringify({ success: true }));
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 400 });
    }
  }

  private broadcastToPlaybook(excludeSessionId: string, message: any): void {
    const [, playbookId] = excludeSessionId.split(':');
    const messageStr = JSON.stringify(message);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId !== excludeSessionId && sessionId.includes(playbookId)) {
        session.send(messageStr);
      }
    }
  }

  // Get playbook analytics from stored data
  async getPlaybookAnalytics(playbookId: string): Promise<any> {
    const keys = await this.state.storage.list({ prefix: `step_complete:` });
    const completions: any[] = [];
    
    for (const [key, value] of keys.entries()) {
      if (key.includes(playbookId)) {
        completions.push(value);
      }
    }
    
    return {
      totalCompletions: completions.length,
      averageTimePerStep: completions.length > 0 
        ? completions.reduce((sum, c) => sum + c.timeSpent, 0) / completions.length 
        : 0,
      completions
    };
  }
}