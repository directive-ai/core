import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';

// Contrôleurs
import { AuthController, InfoController } from './api/auth.controller.js';
import { ApplicationsController } from './api/applications.controller.js';
import { AgentsController } from './api/agents.controller.js';
import { ConfigController } from './api/config.controller.js';
import { DeploymentController } from './api/deployment.controller.js';
import { SessionsController } from './api/sessions.controller.js';

// Services et Middleware
import { AuthMiddleware } from './api/auth.middleware.js';
import { MockIAMService } from './implementations/iam/mock-iam.impl.js';
import { JsonDatabaseService } from './implementations/database/json-database.impl.js';
import { IIAMService, IDatabaseService } from './interfaces/index.js';

@Module({
  imports: [],
  controllers: [
    AuthController,
    InfoController,
    ApplicationsController,
    AgentsController,
    ConfigController,
    DeploymentController,
    SessionsController
  ],
  providers: [
    {
      provide: 'IIAMService',
      useClass: MockIAMService
    },
    {
      provide: 'IDatabaseService',
      useFactory: () => {
        const dbService = new JsonDatabaseService('./data');
        dbService.initialize(); // Initialiser la base de données
        return dbService;
      }
    }
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        '/api/auth/login',
        '/api/health', 
        '/api/info'
      )
      .forRoutes('*'); // Appliquer à toutes les routes sauf les exclusions
  }
} 