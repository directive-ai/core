import { Controller, Get, Post, Delete, Body, Param, Req, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Request } from 'express';
import { IIAMService } from '@/interfaces/index.js';
import { ApiResponse, Application, CreateApplicationRequest } from '@/dto/index.js';

/**
 * Contrôleur pour la gestion des applications
 */
@Controller('api/applications')
export class ApplicationsController {
  constructor(@Inject('IIAMService') private readonly iamService: IIAMService) {}

  @Get()
  async getApplications(@Req() req: Request): Promise<ApiResponse<Application[]>> {
    try {
      const canList = await this.iamService.canListResources(req.user!.userId, 'applications');
      if (!canList) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // Pour cette implémentation mock, retourner des applications de test
      const applications: Application[] = [
        {
          id: 'app_1',
          name: 'Test Application 1',
          description: 'Application de test créée par l\'administrateur',
          author: 'admin',
          version: '1.0.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agents_count: 0,
          metadata: { category: 'test' }
        },
        {
          id: 'app_2', 
          name: 'Dev Application',
          description: 'Application de développement',
          author: req.user!.userId,
          version: '1.0.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agents_count: 0,
          metadata: { category: 'dev' }
        }
      ];

      // Filtrer selon les permissions (admin voit tout, autres voient leurs apps)
      const userPermissions = await this.iamService.getUserPermissions(req.user!.userId);
      const filteredApps = userPermissions.includes('*') || userPermissions.includes('app:*') 
        ? applications 
        : applications.filter(app => app.author === req.user!.userId);
      
      return {
        success: true,
        data: filteredApps
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to retrieve applications', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async createApplication(
    @Body() data: CreateApplicationRequest,
    @Req() req: Request
  ): Promise<ApiResponse<Application>> {
    try {
      const canCreate = await this.iamService.canCreateApplication(req.user!.userId);
      if (!canCreate) {
        throw new HttpException('Insufficient permissions to create applications', HttpStatus.FORBIDDEN);
      }

      // Validation des données
      if (!data.name || data.name.trim().length === 0) {
        throw new HttpException('Application name is required', HttpStatus.BAD_REQUEST);
      }

      // Créer l'application (mock)
      const application: Application = {
        id: `app_${Date.now()}`,
        name: data.name.trim(),
        description: data.description || '',
        author: req.user!.userId,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agents_count: 0,
        metadata: {}
      };
      
      return {
        success: true,
        data: application,
        message: `Application '${application.name}' created successfully`
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create application', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':nameOrId')
  async deleteApplication(
    @Param('nameOrId') nameOrId: string,
    @Req() req: Request
  ): Promise<ApiResponse> {
    try {
      // Pour cette implémentation mock, on simule la recherche d'application
      const mockApp = {
        id: nameOrId.startsWith('app_') ? nameOrId : `app_${nameOrId}`,
        name: nameOrId,
        author: nameOrId === 'admin-app' ? 'admin' : req.user!.userId
      };

      const canDelete = await this.iamService.canDeleteApplication(req.user!.userId, mockApp.id);
      if (!canDelete) {
        throw new HttpException('Insufficient permissions to delete this application', HttpStatus.FORBIDDEN);
      }

      // Simulation de la suppression
      console.log(`Deleting application: ${mockApp.name} (${mockApp.id})`);
      
      return { 
        success: true,
        message: `Application '${nameOrId}' deleted successfully`
      };
    } catch (error: any) {
      if (error.status === HttpStatus.FORBIDDEN) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to delete application', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getApplication(
    @Param('id') id: string,
    @Req() req: Request
  ): Promise<ApiResponse<Application>> {
    try {
      const canList = await this.iamService.canListResources(req.user!.userId, 'applications');
      if (!canList) {
        throw new HttpException('Insufficient permissions', HttpStatus.FORBIDDEN);
      }

      // Mock de récupération d'application
      const application: Application = {
        id: id,
        name: `Application ${id}`,
        description: `Description of application ${id}`,
        author: req.user!.userId,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agents_count: 0,
        metadata: {}
      };
      
      return {
        success: true,
        data: application
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Application not found', 
        error.status || HttpStatus.NOT_FOUND
      );
    }
  }
} 