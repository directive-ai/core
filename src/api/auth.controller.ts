import { Controller, Post, Get, Body, Headers, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { IIAMService } from '../interfaces/index.js';
import { LoginCredentials, ApiResponse, ServerInfo } from '../dto/index.js';

/**
 * Contrôleur d'authentification pour la CLI
 */
@Controller('api/auth')
export class AuthController {
  constructor(@Inject('IIAMService') private readonly iamService: IIAMService) {}

  @Post('login')
  async login(@Body() credentials: LoginCredentials): Promise<ApiResponse> {
    try {
      const result = await this.iamService.login(credentials);
      
      if (!result.success) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      return {
        success: true,
        data: {
          token: result.token,
          user: result.user,
          expiresIn: result.expiresIn
        }
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Authentication failed', 
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  @Post('logout')
  async logout(@Headers('authorization') auth: string): Promise<ApiResponse> {
    try {
      const token = this.extractToken(auth);
      await this.iamService.revokeToken(token);
      
      return { 
        success: true,
        message: 'Successfully logged out'
      };
    } catch (error) {
      // Logout toujours réussi côté client même si erreur serveur
      return { 
        success: true,
        message: 'Logged out'
      };
    }
  }

  @Get('me')
  async whoami(@Headers('authorization') auth: string): Promise<ApiResponse> {
    try {
      const token = this.extractToken(auth);
      const user = await this.iamService.validateToken(token);
      
      if (!user) {
        throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
      }

      return {
        success: true,
        data: user
      };
    } catch (error: any) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('refresh')
  async refresh(@Headers('authorization') auth: string): Promise<ApiResponse> {
    try {
      const token = this.extractToken(auth);
      const newToken = await this.iamService.refreshToken(token);
      
      return {
        success: true,
        data: { 
          token: newToken,
          expiresIn: 24 * 60 * 60 // 24 heures
        }
      };
    } catch (error: any) {
      throw new HttpException('Token refresh failed', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Extrait le token Bearer de l'en-tête Authorization
   */
  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('Missing or invalid authorization header', HttpStatus.UNAUTHORIZED);
    }
    return authHeader.substring(7);
  }
}

/**
 * Contrôleur pour les informations serveur (endpoints publics)
 */
@Controller('api')
export class InfoController {
  
  @Get('health')
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  @Get('info')
  async info(): Promise<ApiResponse<ServerInfo>> {
    return {
      success: true,
      data: {
        version: '1.0.0',
        status: 'healthy',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'local',
        features: ['auth', 'applications', 'agents', 'deployment']
      }
    };
  }
} 