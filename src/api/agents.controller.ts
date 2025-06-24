import { Controller, Get, Post, Delete, Body, Param, Query, Req, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { IIAMService, IDatabaseService } from '../interfaces/index.js';
import { ApiResponse, CLIDeployAgentRequest } from '../dto/index.js';
import { BundleStorageService } from '../implementations/storage/bundle-storage.service.js';

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
  private readonly bundleStorage: BundleStorageService;

  constructor(
    @Inject('IIAMService') private readonly iamService: IIAMService,
    @Inject('IDatabaseService') private readonly databaseService: IDatabaseService
  ) {
    this.bundleStorage = new BundleStorageService();
  }

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

      // Récupérer les agents depuis la base de données
      const dbAgents = await this.databaseService.getRegisteredAgents({ application_id: applicationId });
      
      // Convertir au format Agent compatible CLI
      let agents: Agent[] = dbAgents.map(dbAgent => ({
        id: dbAgent.id,
        name: dbAgent.name,
        type: dbAgent.type,
        applicationId: dbAgent.application_id,
        status: dbAgent.status === 'active' ? 'deployed' : 'created',
        author: dbAgent.metadata?.author || 'unknown',
        created_at: dbAgent.created_at,
        lastDeployedAt: dbAgent.deployed_at,
        description: dbAgent.description
      }));

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

      // Créer l'agent dans la base de données
      const dbAgent = await this.databaseService.createAgent({
        type: data.type,
        application_id: data.applicationId,
        name: data.name.trim(),
        description: data.description || '',
        version: '1.0.0',
        author: req.user!.userId
      });
      
      // Convertir au format Agent compatible CLI
      const agent: Agent = {
        id: dbAgent.id,
        name: dbAgent.name,
        type: dbAgent.type,
        applicationId: dbAgent.application_id,
        status: 'created',
        author: req.user!.userId,
        created_at: dbAgent.created_at,
        description: dbAgent.description
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

      // 1. Récupérer l'agent pour obtenir son ID
      const dbAgents = await this.databaseService.getRegisteredAgents();
      const agent = dbAgents.find(a => a.id === nameOrId || a.name === nameOrId || a.type.endsWith(`/${nameOrId}`));
      
      if (!agent) {
        throw new HttpException(`Agent '${nameOrId}' not found`, HttpStatus.NOT_FOUND);
      }

      // 2. Supprimer tous les bundles stockés
      try {
        const bundleDeleteResult = await this.bundleStorage.deleteAllVersions(agent.id);
        if (!bundleDeleteResult.success) {
          console.warn(`Warning: Failed to delete bundles for agent ${agent.id}: ${bundleDeleteResult.message}`);
        } else {
          console.log(`Deleted ${bundleDeleteResult.deletedVersions.length} bundle versions for agent ${agent.id}`);
        }
      } catch (bundleError) {
        console.warn(`Warning: Error deleting bundles for agent ${agent.id}:`, bundleError);
      }

      // 3. Supprimer l'agent de la base de données
      await this.databaseService.removeAgent(agent.id);
      
      return { 
        success: true,
        message: `Agent '${agent.name}' and all its versions deleted successfully`
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete agent', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 