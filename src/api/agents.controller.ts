import { Controller, Get, Post, Delete, Body, Param, Query, Req, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { IIAMService } from '../interfaces/index.js';
import { ApiResponse, CLIDeployAgentRequest } from '../dto/index.js';

/**
 * Interface pour la création d'agent (local)
 */
interface CreateAgentRequest {
  name: string;
  type: string;
  applicationId: string;
  description?: string;
}

/**
 * Interface pour les agents (compatible CLI)
 */
interface Agent {
  id: string;
  name: string;
  type: string;
  applicationId: string;
  status: 'created' | 'deployed' | 'running' | 'stopped' | 'error';
  author: string;
  created_at: string;
  lastDeployedAt?: string;
  description?: string;
}

/**
 * Contrôleur pour la gestion des agents
 */
@Controller('api/agents')
export class AgentsController {
  constructor(@Inject('IIAMService') private readonly iamService: IIAMService) {}

  @Get()
  async getAgents(
    @Req() req: Request,
    @Query('applicationId') applicationId?: string
  ): Promise<ApiResponse<Agent[]>> {
    try {
      const canList = await this.iamService.canListResources(req.user!.userId, 'agents');
      if (!canList) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // Mock d'agents de test
      let agents: Agent[] = [
        {
          id: 'agent_1',
          name: 'Test Agent 1',
          type: 'conversational',
          applicationId: 'app_1',
          status: 'deployed',
          author: 'admin',
          created_at: new Date().toISOString(),
          lastDeployedAt: new Date().toISOString(),
          description: 'Agent de test pour les conversations'
        },
        {
          id: 'agent_2',
          name: 'Dev Agent',
          type: 'task',
          applicationId: 'app_2',
          status: 'created',
          author: req.user!.userId,
          created_at: new Date().toISOString(),
          description: 'Agent de développement'
        }
      ];

      // Filtrer par application si spécifié
      if (applicationId) {
        agents = agents.filter(agent => agent.applicationId === applicationId);
      }

      // Filtrer selon les permissions
      const userPermissions = await this.iamService.getUserPermissions(req.user!.userId);
      const filteredAgents = userPermissions.includes('*') || userPermissions.includes('agent:*') 
        ? agents 
        : agents.filter(agent => agent.author === req.user!.userId);
      
      return {
        success: true,
        data: filteredAgents
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to retrieve agents', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async createAgent(
    @Body() data: CreateAgentRequest,
    @Req() req: Request
  ): Promise<ApiResponse<Agent>> {
    try {
      const canCreate = await this.iamService.canCreateAgent(req.user!.userId, data.applicationId);
      if (!canCreate) {
        throw new HttpException('Insufficient permissions to create agents', HttpStatus.FORBIDDEN);
      }

      // Validation des données
      if (!data.name || data.name.trim().length === 0) {
        throw new HttpException('Agent name is required', HttpStatus.BAD_REQUEST);
      }

      if (!data.applicationId) {
        throw new HttpException('Application ID is required', HttpStatus.BAD_REQUEST);
      }

      // Créer l'agent (mock)
      const agent: Agent = {
        id: `agent_${Date.now()}`,
        name: data.name.trim(),
        type: data.type || 'default',
        applicationId: data.applicationId,
        status: 'created',
        author: req.user!.userId,
        created_at: new Date().toISOString(),
        description: data.description
      };
      
      return {
        success: true,
        data: agent,
        message: `Agent '${agent.name}' created successfully`
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create agent', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/deploy')
  async deployAgent(
    @Param('id') id: string,
    @Body() data: CLIDeployAgentRequest,
    @Req() req: Request
  ): Promise<ApiResponse> {
    try {
      const canDeploy = await this.iamService.canDeployAgent(req.user!.userId, id);
      if (!canDeploy) {
        throw new HttpException('Insufficient permissions to deploy this agent', HttpStatus.FORBIDDEN);
      }

      // Mock de déploiement
      console.log(`Deploying agent: ${id} (force: ${data.force || false})`);
      
      return { 
        success: true,
        message: `Agent '${id}' deployed successfully`
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to deploy agent', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/status')
  async getAgentStatus(
    @Param('id') id: string,
    @Req() req: Request
  ): Promise<ApiResponse<Agent>> {
    try {
      const canList = await this.iamService.canListResources(req.user!.userId, 'agents');
      if (!canList) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // Mock de statut d'agent
      const agent: Agent = {
        id: id,
        name: `Agent ${id}`,
        type: 'conversational',
        applicationId: 'app_1',
        status: 'running',
        author: req.user!.userId,
        created_at: new Date().toISOString(),
        lastDeployedAt: new Date().toISOString(),
        description: `Status for agent ${id}`
      };
      
      return {
        success: true,
        data: agent
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Agent not found', 
        error.status || HttpStatus.NOT_FOUND
      );
    }
  }

  @Delete(':nameOrId')
  async deleteAgent(
    @Param('nameOrId') nameOrId: string,
    @Req() req: Request
  ): Promise<ApiResponse> {
    try {
      const canDelete = await this.iamService.canDeleteAgent(req.user!.userId, nameOrId);
      if (!canDelete) {
        throw new HttpException('Insufficient permissions to delete this agent', HttpStatus.FORBIDDEN);
      }

      // Simulation de la suppression
      console.log(`Deleting agent: ${nameOrId}`);
      
      return { 
        success: true,
        message: `Agent '${nameOrId}' deleted successfully`
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete agent', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 