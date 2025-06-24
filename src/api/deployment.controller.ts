import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  UploadedFile, 
  UseInterceptors, 
  Req,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiResponse } from '../dto/index.js';
import { BundleStorageService, type BundleMetadata } from '../implementations/storage/bundle-storage.service.js';

// DTOs pour le déploiement (à ajouter dans auth.dto.ts)
interface UploadBundleRequest {
  agentId: string;
  version: string;
  force?: boolean;
  metadata: {
    buildHash: string;
    buildTime: string;
    dependencies: Record<string, string>;
    gitCommit?: string;
  };
}

interface UploadBundleResponse {
  success: boolean;
  deploymentId: string;
  version: string;
  url?: string;
  rollbackVersion?: string;
  bundleSize: number;
  message: string;
}

interface AgentVersion {
  id: string;
  agentId: string;
  version: string;
  bundleSize: number;
  deployedAt: string;
  status: 'active' | 'inactive' | 'rollback';
  metadata: {
    buildHash: string;
    buildTime: string;
    dependencies: Record<string, string>;
    gitCommit?: string;
  };
  url?: string;
}

/**
 * DeploymentController - Gestion des déploiements d'agents
 * 
 * Endpoints pour l'upload, versioning et gestion des bundles d'agents
 */
@Controller('api/deployments')
export class DeploymentController {
  private readonly bundleStorage: BundleStorageService;

  constructor() {
    this.bundleStorage = new BundleStorageService();
  }

  /**
   * POST /api/deployments/upload
   * Upload d'un bundle d'agent compilé
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('bundle'))
  async uploadBundle(
    @UploadedFile() file: any, // Express.Multer.File - types à installer
    @Body() body: any,
    @Req() req: Request
  ): Promise<ApiResponse<UploadBundleResponse>> {
    try {
      // Validation du fichier
      if (!file) {
        throw new HttpException('Aucun fichier bundle fourni', HttpStatus.BAD_REQUEST);
      }

      if (!file.originalname.endsWith('.js')) {
        throw new HttpException('Le bundle doit être un fichier .js', HttpStatus.BAD_REQUEST);
      }

      // Parser les données depuis FormData
      const agentId = body.agentId;
      const version = body.version;
      const force = body.force === 'true';
      
      let parsedMetadata: any;
      try {
        parsedMetadata = JSON.parse(body.metadata || '{}');
      } catch (error) {
        throw new HttpException('Métadonnées invalides (JSON requis)', HttpStatus.BAD_REQUEST);
      }

      // Validation des paramètres requis
      if (!agentId || !version) {
        throw new HttpException('agentId et version sont requis', HttpStatus.BAD_REQUEST);
      }

      // TODO: Vérifier que l'agent existe et que l'utilisateur a les permissions
      
      // Préparer les métadonnées complètes pour le stockage
      const bundleMetadata: BundleMetadata = {
        ...parsedMetadata,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'current-user', // TODO: récupérer depuis req.user
        fileSize: file.size,
        originalName: file.originalname
      };

      // Stocker le bundle avec versioning
      const storageResult = await this.bundleStorage.storeBundle(
        agentId,
        version,
        file.buffer,
        bundleMetadata,
        force
      );

      if (!storageResult.success) {
        throw new HttpException(storageResult.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Génération d'un ID de déploiement unique
      const deploymentId = `deploy_${agentId}_${Date.now()}`;

      const response: UploadBundleResponse = {
        success: true,
        deploymentId,
        version,
        url: `${req.protocol}://${req.get('host')}/agents/${agentId}`,
        rollbackVersion: storageResult.previousVersion,
        bundleSize: file.size,
        message: `Agent ${agentId} déployé en version ${version}`
      };

      return {
        success: true,
        data: response,
        message: 'Bundle uploadé avec succès'
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      return {
        success: false,
        error: `Erreur lors de l'upload du bundle: ${error.message}`
      };
    }
  }

  /**
   * GET /api/deployments/agent/:agentId/versions
   * Liste des versions déployées d'un agent
   */
  @Get('agent/:agentId/versions')
  async getAgentVersions(@Param('agentId') agentId: string, @Req() req: Request): Promise<ApiResponse<AgentVersion[]>> {
    try {
      // TODO: Vérifier les permissions de lecture
      
      const storedVersions = await this.bundleStorage.getAgentVersions(agentId);
      
      // Transformer en format API
      const versions: AgentVersion[] = storedVersions.map(v => ({
        id: v.id,
        agentId: v.agentId,
        version: v.version,
        bundleSize: v.bundleSize,
        deployedAt: v.deployedAt,
        status: v.status,
        metadata: {
          buildHash: v.metadata.buildHash,
          buildTime: v.metadata.buildTime,
          dependencies: v.metadata.dependencies,
          gitCommit: v.metadata.gitCommit
        },
        url: v.status === 'active' 
          ? `${req.protocol}://${req.get('host')}/agents/${agentId}`
          : `${req.protocol}://${req.get('host')}/agents/${agentId}/versions/${v.version}`
      }));

      return {
        success: true,
        data: versions,
        message: `${versions.length} versions trouvées pour l'agent ${agentId}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la récupération des versions: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * POST /api/deployments/agent/:agentId/rollback/:version
   * Rollback vers une version précédente
   */
  @Post('agent/:agentId/rollback/:version')
  async rollbackAgent(
    @Param('agentId') agentId: string, 
    @Param('version') version: string
  ): Promise<ApiResponse<{ previousVersion: string; newVersion: string }>> {
    try {
      // TODO: Vérifier les permissions
      
      const rollbackResult = await this.bundleStorage.rollbackToVersion(agentId, version);
      
      if (!rollbackResult.success) {
        throw new Error(rollbackResult.message);
      }
      
      return {
        success: true,
        data: {
          previousVersion: rollbackResult.previousVersion || 'none',
          newVersion: rollbackResult.newVersion
        },
        message: rollbackResult.message
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors du rollback: ${error instanceof Error ? error.message : error}`
      };
    }
  }
} 