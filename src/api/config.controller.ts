import { Controller, Get } from '@nestjs/common';
import { 
  ApiResponse, 
  ExtendedServerInfo 
} from '../dto/index.js';

/**
 * ConfigController - Informations serveur étendues
 * 
 * Endpoints pour que la CLI puisse connaître les capacités du serveur
 */
@Controller('api/config')
export class ConfigController {





  /**
   * GET /api/config/server-info
   * Informations sur le serveur Directive (endpoint public)
   */
  @Get('server-info')
  async getServerInfo(): Promise<ApiResponse<ExtendedServerInfo>> {
    try {
      const serverInfo: ExtendedServerInfo = {
        name: 'Directive Core Server',
        version: '1.0.0',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'local',
        baseUrl: process.env.SERVER_URL || 'http://localhost:3000',
        status: 'healthy',
        features: {
          authentication: true,
          deployments: true,
          templating: true,
          versioning: true
        }
      };

      return {
        success: true,
        data: serverInfo,
        message: 'Informations serveur récupérées'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erreur lors de la récupération des informations serveur'
      };
    }
  }
} 