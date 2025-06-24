import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Req, 
  HttpException, 
  HttpStatus,
  Inject 
} from '@nestjs/common';
import type { Request } from 'express';
import { IIAMService, IDatabaseService } from '../interfaces/index.js';
import { 
  ApiResponse, 
  CreateSessionRequest, 
  CreateSessionResponse, 
  SessionEvent, 
  SessionEventResponse,
  Session 
} from '../dto/index.js';
import { BundleStorageService } from '../implementations/storage/bundle-storage.service.js';
import { AgentDirecteurFactory, AgentMachineInstance } from '../core/agent-factory/agent-factory.js';

/**
 * Controller pour la gestion des sessions d'agents
 */
@Controller('api/sessions')
export class SessionsController {
  private readonly bundleStorage: BundleStorageService;
  private readonly agentFactory: AgentDirecteurFactory;
  private sessions: Map<string, AgentMachineInstance> = new Map(); // Instances réelles XState

  constructor(
    @Inject('IIAMService') private readonly iamService: IIAMService,
    @Inject('IDatabaseService') private readonly databaseService: IDatabaseService
  ) {
    this.bundleStorage = new BundleStorageService();
    this.agentFactory = AgentDirecteurFactory.getInstance(databaseService);
  }

  /**
   * POST /api/sessions
   * Crée une nouvelle session avec un agent
   */
  @Post()
  async createSession(
    @Body() data: CreateSessionRequest,
    @Req() req: Request
  ): Promise<ApiResponse<CreateSessionResponse>> {
    try {
      // 1. Vérifier les permissions
      const canCreate = await this.iamService.canListResources(req.user!.userId, 'agents');
      if (!canCreate) {
        throw new HttpException('Insufficient permissions to create sessions', HttpStatus.FORBIDDEN);
      }

      // 2. Vérifier que l'agent existe via AgentDirecteurFactory
      const agent = await this.agentFactory.getAgent(data.agent_type);
      
      if (!agent) {
        throw new HttpException(`Agent "${data.agent_type}" not found`, HttpStatus.NOT_FOUND);
      }

      if (agent.status !== 'active') {
        throw new HttpException(`Agent "${data.agent_type}" is not active (status: ${agent.status})`, HttpStatus.BAD_REQUEST);
      }

      // 3. Créer l'instance de machine XState via AgentDirecteurFactory
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const createdAt = new Date().toISOString();

      const machineInstance = await this.agentFactory.createMachineInstance(
        data.agent_type,
        sessionId,
        data.restore_state || undefined // Restaurer état si fourni
      );

      // 4. Stocker l'instance en mémoire
      this.sessions.set(sessionId, machineInstance);

      // 5. Obtenir l'état initial de la machine
      const currentSnapshot = machineInstance.interpreter.getSnapshot();
      const initialState = currentSnapshot.value;

      // 6. Créer la session en base de données
      const session: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: data.agent_type,
        status: 'active' as any,
        current_state: {
          xstate_state: initialState,
          context: currentSnapshot.context || {},
          history: [initialState]
        },
        conversation_history: []
      };

      await this.databaseService.createSession(session);

      // 7. Générer la première réponse de l'agent basée sur l'état réel
      const agentResponse = {
        type: 'instruction' as const,
        instruction: this.generateInstructionForState(initialState, agent.name),
        format: {
          type: 'structured' as const,
          schema: { event: 'string', data: 'object' },
          required: ['event']
        },
        context: {
          documents: [],
          metadata: {
            sessionId,
            agentType: data.agent_type,
            currentState: initialState,
            availableEvents: this.getAvailableEvents(machineInstance)
          }
        }
      };

      const response: CreateSessionResponse = {
        session_id: sessionId,
        state: initialState,
        created_at: createdAt,
        agent_response: agentResponse
      };

      return {
        success: true,
        data: response,
        message: `Session created successfully with agent ${data.agent_type}`
      };

    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create session', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * POST /api/sessions/:sessionId/events
   * Envoie un événement à une session
   */
  @Post(':sessionId/events')
  async sendEvent(
    @Param('sessionId') sessionId: string,
    @Body() eventData: SessionEvent,
    @Req() req: Request
  ): Promise<ApiResponse<SessionEventResponse>> {
    try {
      // 1. Vérifier les permissions
      const canAccess = await this.iamService.canListResources(req.user!.userId, 'agents');
      if (!canAccess) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // 2. Récupérer l'instance de machine
      const machineInstance = this.sessions.get(sessionId);
      if (!machineInstance) {
        throw new HttpException(`Session "${sessionId}" not found or expired`, HttpStatus.NOT_FOUND);
      }

      // 3. Obtenir l'état avant transition
      const beforeSnapshot = machineInstance.interpreter.getSnapshot();
      const stateBefore = beforeSnapshot.value;

      // 4. Envoyer l'événement à la machine XState réelle
      try {
        machineInstance.interpreter.send({
          type: eventData.event,
          data: eventData.data
        });
      } catch (machineError: any) {
        throw new HttpException(
          `Invalid event "${eventData.event}" for current state: ${machineError.message}`, 
          HttpStatus.BAD_REQUEST
        );
      }

      // 5. Obtenir le nouvel état
      const afterSnapshot = machineInstance.interpreter.getSnapshot();
      const stateAfter = afterSnapshot.value;

      // 6. Mettre à jour l'état courant dans l'instance
      machineInstance.currentState = afterSnapshot;

      // 7. Générer la réponse de l'agent basée sur le nouvel état
      const agentResponse = {
        type: 'instruction' as const,
        instruction: this.generateInstructionForState(stateAfter, machineInstance.agentType),
        format: {
          type: 'structured' as const,
          schema: { event: 'string', data: 'object' },
          required: ['event']
        },
        context: {
          documents: [],
          metadata: {
            sessionId,
            agentType: machineInstance.agentType,
            currentState: stateAfter,
            context: afterSnapshot.context,
            availableEvents: this.getAvailableEvents(machineInstance)
          }
        }
      };

      // 8. Enregistrer l'événement en base
      await this.databaseService.addConversationEntry(sessionId, {
        from: 'agent_directeur',
        to: 'agent_executant',
        content: `Event: ${eventData.event}`,
        state_before: stateBefore,
        state_after: stateAfter,
        trigger: eventData.event
      });

      const response: SessionEventResponse = {
        session_id: sessionId,
        state: stateAfter,
        agent_response: agentResponse,
        message: `Event "${eventData.event}" processed successfully`
      };

      return {
        success: true,
        data: response
      };

    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to process event', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/sessions/:sessionId
   * Récupère l'état actuel d'une session
   */
  @Get(':sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ): Promise<ApiResponse<any>> {
    try {
      // 1. Vérifier les permissions
      const canAccess = await this.iamService.canListResources(req.user!.userId, 'agents');
      if (!canAccess) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // 2. Récupérer l'instance de machine
      const machineInstance = this.sessions.get(sessionId);
      if (!machineInstance) {
        throw new HttpException(`Session "${sessionId}" not found`, HttpStatus.NOT_FOUND);
      }

      // 3. Obtenir l'état actuel de la machine
      const currentSnapshot = machineInstance.interpreter.getSnapshot();

      // 4. Récupérer l'historique depuis la base
      const history = await this.databaseService.getSessionHistory(sessionId);

      const sessionData = {
        session_id: sessionId,
        agent_type: machineInstance.agentType,
        current_state: currentSnapshot.value,
        context: currentSnapshot.context,
        created_at: new Date().toISOString(), // TODO: récupérer depuis la base
        status: machineInstance.interpreter.getSnapshot().done ? 'completed' : 'active',
        conversation_history: history,
        available_events: this.getAvailableEvents(machineInstance)
      };

      return {
        success: true,
        data: sessionData
      };

    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to retrieve session', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/sessions
   * Liste toutes les sessions actives
   */
  @Get()
  async getAllSessions(@Req() req: Request): Promise<ApiResponse<any[]>> {
    try {
      // 1. Vérifier les permissions
      const canAccess = await this.iamService.canListResources(req.user!.userId, 'agents');
      if (!canAccess) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // 2. Récupérer les sessions depuis la base
      const activeSessions = await this.databaseService.getActiveSessions();

      // 3. Enrichir avec les données des instances en mémoire
      const enrichedSessions = activeSessions.map(session => {
        const machineInstance = this.sessions.get(session.session_id);
        if (machineInstance) {
          const currentSnapshot = machineInstance.interpreter.getSnapshot();
          return {
            ...session,
            current_state: currentSnapshot.value,
            context: currentSnapshot.context,
            available_events: this.getAvailableEvents(machineInstance)
          };
        }
        return session;
      });

      return {
        success: true,
        data: enrichedSessions
      };

    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to retrieve sessions', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Génère une instruction basée sur l'état actuel de la machine
   */
  private generateInstructionForState(state: any, agentName: string): string {
    const stateString = typeof state === 'object' ? JSON.stringify(state) : state;
    
    switch (stateString) {
      case 'idle':
        return `Agent ${agentName} is ready. Send a PROCESS event with your data to start processing.`;
      case 'processing':
        return `Agent ${agentName} is currently processing your request. Please wait...`;
      case 'success':
        return `Agent ${agentName} has completed processing successfully. Send a RESET event to start a new task.`;
      case 'error':
        return `Agent ${agentName} encountered an error. Send a RESET event to retry or CANCEL to abort.`;
      default:
        return `Agent ${agentName} is in state "${stateString}". Check available events for next actions.`;
    }
  }

  /**
   * Récupère les événements disponibles pour l'état actuel
   */
  private getAvailableEvents(machineInstance: AgentMachineInstance): string[] {
    try {
      const currentSnapshot = machineInstance.interpreter.getSnapshot();
      // XState v5 : nextEvents donne les événements possibles
      return currentSnapshot.nextEvents || [];
    } catch (error) {
      // Fallback : événements génériques
      return ['PROCESS', 'RESET', 'CANCEL'];
    }
  }
} 