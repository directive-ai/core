import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';

// Contrôleurs
import { AuthController, InfoController } from './api/auth.controller.js';
import { ApplicationsController } from './api/applications.controller.js';
import { AgentsController } from './api/agents.controller.js';
import { ConfigController } from './api/config.controller.js';
import { DeploymentController } from './api/deployment.controller.js';

// Services et Middleware
import { AuthMiddleware } from './api/auth.middleware.js';
import { MockIAMService } from './implementations/iam/mock-iam.impl.js';
import { IIAMService } from './interfaces/index.js';

@Module({
  imports: [],
  controllers: [
    AuthController,
    InfoController,
    ApplicationsController,
    AgentsController,
    ConfigController,
    DeploymentController
  ],
  providers: [
    {
      provide: 'IIAMService',
      useClass: MockIAMService
    }
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*'); // Appliquer à toutes les routes (middleware gère les routes publiques)
  }
} 