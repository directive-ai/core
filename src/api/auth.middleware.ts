import { Injectable, NestMiddleware, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { IIAMService } from '../interfaces/index.js';
import { UserContext } from '../dto/index.js';

// Extension de Request pour inclure l'utilisateur
declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

/**
 * Middleware d'authentification pour valider les tokens JWT
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(@Inject('IIAMService') private readonly iamService: IIAMService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip auth pour certaines routes publiques
    console.log(`[AuthMiddleware] Path: ${req.path}, Method: ${req.method}`);
    
    if (this.isPublicRoute(req.path)) {
      console.log(`[AuthMiddleware] Public route detected: ${req.path}`);
      return next();
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new HttpException('Missing authorization header', HttpStatus.UNAUTHORIZED);
      }

      const token = authHeader.substring(7);
      const user = await this.iamService.validateToken(token);
      
      if (!user) {
        throw new HttpException('Invalid or expired token', HttpStatus.UNAUTHORIZED);
      }

      // Ajouter l'utilisateur à la requête pour les contrôleurs
      req.user = user;
      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Vérifie si la route est publique (ne nécessite pas d'authentification)
   */
  private isPublicRoute(path: string): boolean {
    const publicRoutes = [
      '/api/auth/login',
      '/api/health',
      '/api/info'
    ];
    
    // Aussi permettre les routes de développement/test
    const devRoutes = [
      '/api/docs',
      '/api/swagger'
    ];

    const allPublicRoutes = [...publicRoutes, ...devRoutes];
    
    return allPublicRoutes.some(route => path.startsWith(route));
  }
} 