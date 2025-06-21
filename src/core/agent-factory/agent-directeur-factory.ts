import { createMachine, interpret } from 'xstate';
import { IDatabaseService } from '../../interfaces/database.interface.js';
import { AgentRegistration, DeployAgentRequest, DeployAgentResponse, GitCommitStrategy } from '../../dto/index.js';
import * as crypto from 'crypto';
import { ensureCommitted, getCurrentGitCommitId } from './git-utils.js';

/**
 * Interface pour une définition de machine d'agent directeur
 */
export interface AgentMachineDefinition {
  machine: any; // Machine XState
  metadata: {
    name: string;
    description: string;
    version: string;
  };
}

/**
 * Interface pour une instance de machine d'agent directeur
 */
export interface AgentMachineInstance {
  agentType: string;
  interpreter: any; // Interpréteur XState
  currentState: any; // État XState sérialisable
  sessionId: string;
}

/**
 * Factory singleton pour la gestion des agents directeurs
 * 
 * Cette factory gère :
 * - L'enregistrement des machines XState des agents directeurs
 * - La validation des machines avant enregistrement
 * - L'instanciation des machines avec état restauré depuis BDD
 * - Le cache des définitions de machines en mémoire
 */
export class AgentDirecteurFactory {
  private static instance: AgentDirecteurFactory;
  private machineDefinitions: Map<string, AgentMachineDefinition> = new Map();
  private database: IDatabaseService;

  private constructor(database: IDatabaseService) {
    this.database = database;
  }

  /**
   * Obtient l'instance singleton de la factory
   */
  public static getInstance(database?: IDatabaseService): AgentDirecteurFactory {
    if (!AgentDirecteurFactory.instance) {
      if (!database) {
        throw new Error('Database service is required for first initialization');
      }
      AgentDirecteurFactory.instance = new AgentDirecteurFactory(database);
    }
    return AgentDirecteurFactory.instance;
  }

  /**
   * Réinitialise l'instance singleton (utile pour les tests)
   */
  public static resetInstance(): void {
    AgentDirecteurFactory.instance = null as any;
  }

  /**
   * Enregistre ou déploie un agent directeur avec sa machine XState
   */
  async registerAgent(
    agentType: string,
    machineDefinition: any, // Machine XState
    metadata: {
      name: string;
      description: string;
      version: string;
      application_id: string;
      file_path?: string;
      git_strategy?: GitCommitStrategy;
      git_commit_message?: string;
    }
  ): Promise<DeployAgentResponse> {
    const startTime = Date.now();
    
    // S'assurer que le code est committé selon la stratégie choisie
    const gitStrategy = metadata.git_strategy || 'strict';
    const gitResult = ensureCommitted(
      gitStrategy,
      metadata.git_commit_message,
      process.cwd()
    );

    // Si la stratégie Git échoue (ex: 'strict' avec modifications non commitées)
    if (!gitResult.success) {
      const deploymentTime = Date.now() - startTime;
      return {
        success: false,
        agent_type: agentType,
        old_version: 0,
        new_version: 0,
        git_commit_id: gitResult.commit_id,
        git_strategy_used: gitResult.strategy_used,
        git_was_dirty: gitResult.was_dirty,
        deployed_at: new Date().toISOString(),
        affected_sessions: 0,
        compilation_time_ms: 0,
        deployment_time_ms: deploymentTime,
        message: `Git strategy failed: ${gitResult.error}`,
        warnings: []
      };
    }

    const warnings: string[] = [];
    if (gitResult.message && gitResult.strategy_used === 'warn') {
      warnings.push(gitResult.message);
    }

    try {
      // 1. Valider la machine XState
      console.log('🔍 [DEBUG] Starting machine validation...');
      await this.validateMachine(machineDefinition);
      console.log('✅ [DEBUG] Machine validation passed');

      // 2. Calculer le hash du code source
      console.log('🔍 [DEBUG] Calculating machine hash...');
      const sourceHash = this.calculateMachineHash(machineDefinition);
      console.log('✅ [DEBUG] Machine hash calculated:', sourceHash);

      // 3. Préparer les données pour la BDD
      console.log('🔍 [DEBUG] Preparing agent data for database...');
      console.log('🔍 [DEBUG] Serializing machine...');
      const serializedMachine = this.serializeMachine(machineDefinition);
      console.log('✅ [DEBUG] Machine serialized');
      
      const agentData: Omit<AgentRegistration, 'id' | 'created_at' | 'updated_at' | 'deployed_at'> = {
        type: agentType,
        application_id: metadata.application_id,
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        deployment_version: 1, // Sera incrémenté automatiquement si agent existant
        git_commit_id: gitResult.commit_id, // ID du commit Git correspondant au code
        status: 'active',
        machine_definition: serializedMachine,
        metadata: {
          file_path: metadata.file_path,
          source_hash: sourceHash,
          needs_deployment: false,
          deployment_strategy: 'wait'
        }
      };
      console.log('✅ [DEBUG] Agent data prepared');

      // 4. Enregistrer en BDD (avec versioning automatique)
      console.log('🔍 [DEBUG] Getting existing agent...');
      const existingAgent = await this.database.getAgentByType(agentType);
      const oldVersion = existingAgent?.deployment_version || 0;
      console.log('✅ [DEBUG] Existing agent checked, oldVersion:', oldVersion);
      
      console.log('🔍 [DEBUG] Registering agent in database...');
      const registeredAgent = await this.database.registerAgent(agentData);
      console.log('✅ [DEBUG] Agent registered in database');

      // 5. Mettre à jour le cache en mémoire
      console.log('🔍 [DEBUG] Updating cache...');
      this.machineDefinitions.set(agentType, {
        machine: machineDefinition,
        metadata: {
          name: metadata.name,
          description: metadata.description,
          version: metadata.version
        }
      });
      console.log('✅ [DEBUG] Cache updated');

      const deploymentTime = Date.now() - startTime;

      // Enrichir le message avec les informations Git
      console.log('🔍 [DEBUG] Building response message...');
      let message = `Agent ${agentType} deployed successfully (v${oldVersion} → v${registeredAgent.deployment_version})`;
      if (gitResult.commit_id) {
        message += ` @ ${gitResult.commit_id.substring(0, 7)}`;
      }
      if (gitResult.was_dirty && gitResult.strategy_used === 'auto-commit') {
        message += ` (auto-committed ${gitResult.committed_files?.length || 0} files)`;
      }
      console.log('✅ [DEBUG] Message built');

      console.log('🔍 [DEBUG] Getting active sessions count...');
      const activeSessionsCount = await this.getActiveSessionsCount(agentType);
      console.log('✅ [DEBUG] Active sessions count:', activeSessionsCount);

      console.log('🔍 [DEBUG] Building final response...');
      return {
        success: true,
        agent_type: agentType,
        old_version: oldVersion,
        new_version: registeredAgent.deployment_version,
        git_commit_id: gitResult.commit_id,
        git_strategy_used: gitResult.strategy_used,
        git_was_dirty: gitResult.was_dirty,
        git_committed_files: gitResult.committed_files,
        deployed_at: registeredAgent.deployed_at,
        affected_sessions: activeSessionsCount,
        compilation_time_ms: 0, // Pas de compilation ici, juste validation
        deployment_time_ms: deploymentTime,
        message,
        warnings
      };

    } catch (error) {
      const deploymentTime = Date.now() - startTime;
      
      return {
        success: false,
        agent_type: agentType,
        old_version: 0,
        new_version: 0,
        git_commit_id: gitResult.commit_id,
        git_strategy_used: gitResult.strategy_used,
        git_was_dirty: gitResult.was_dirty,
        git_committed_files: gitResult.committed_files,
        deployed_at: new Date().toISOString(),
        affected_sessions: 0,
        compilation_time_ms: 0,
        deployment_time_ms: deploymentTime,
        message: `Failed to deploy agent ${agentType}: ${error instanceof Error ? error.message : error}`,
        warnings
      };
    }
  }

  /**
   * Crée une instance de machine XState avec l'état restauré depuis la BDD
   */
  async createMachineInstance(
    agentType: string,
    sessionId: string,
    currentState?: any
  ): Promise<AgentMachineInstance> {
    // 1. Récupérer la définition de machine depuis le cache
    const machineDefinition = this.machineDefinitions.get(agentType);
    
    if (!machineDefinition) {
      // Tentative de chargement depuis la BDD
      await this.loadAgentFromDatabase(agentType);
      const reloadedDefinition = this.machineDefinitions.get(agentType);
      
      if (!reloadedDefinition) {
        throw new Error(`Agent type ${agentType} not found in factory`);
      }
    }

    const definition = this.machineDefinitions.get(agentType)!;

    // 2. Créer l'interpréteur
    const interpreter = interpret(definition.machine);

    // 3. Si on a un état à restaurer, l'utiliser
    if (currentState) {
      // Restaurer l'état depuis les données sérialisées
      interpreter.start();
      // Note: XState v5 nécessite une approche différente pour restaurer l'état
      // Pour l'instant, on démarre avec l'état initial et on appliquera les transitions
      const snapshot = interpreter.getSnapshot();
      return {
        agentType,
        interpreter,
        currentState: currentState, // État sérialisé à restaurer
        sessionId
      };
    } else {
      interpreter.start();
      const snapshot = interpreter.getSnapshot();
      return {
        agentType,
        interpreter,
        currentState: snapshot,
        sessionId
      };
    }
  }

  /**
   * Récupère la liste des agents directeurs disponibles
   */
  async listAgents(filter?: { application_id?: string }): Promise<AgentRegistration[]> {
    return await this.database.getRegisteredAgents(filter);
  }

  /**
   * Récupère un agent directeur par son type
   */
  async getAgent(agentType: string): Promise<AgentRegistration | null> {
    return await this.database.getAgentByType(agentType);
  }

  /**
   * Supprime un agent directeur
   */
  async removeAgent(agentType: string): Promise<void> {
    const agent = await this.database.getAgentByType(agentType);
    if (agent) {
      await this.database.removeAgent(agent.id);
      this.machineDefinitions.delete(agentType);
    }
  }

  /**
   * Charge un agent depuis la BDD dans le cache mémoire
   */
  private async loadAgentFromDatabase(agentType: string): Promise<void> {
    const agent = await this.database.getAgentByType(agentType);
    if (!agent || !agent.machine_definition) {
      throw new Error(`Agent ${agentType} not found in database`);
    }

    try {
      const machine = this.deserializeMachine(agent.machine_definition);
      this.machineDefinitions.set(agentType, {
        machine,
        metadata: {
          name: agent.name,
          description: agent.description,
          version: agent.version
        }
      });
    } catch (error) {
      throw new Error(`Failed to load machine for agent ${agentType}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Valide qu'une machine XState est correctement formée
   */
  private async validateMachine(machine: any): Promise<void> {
    try {
      // 1. Vérifier que la machine a une config
      const config = machine.config || machine;
      
      // 2. Vérifier que la config a des états
      if (!config.states || Object.keys(config.states).length === 0) {
        throw new Error('Machine must have at least one state');
      }

      // 3. Vérifier que l'état initial existe
      if (!config.initial) {
        throw new Error('Machine must have an initial state');
      }

      if (!config.states[config.initial]) {
        throw new Error(`Initial state '${config.initial}' not found in machine states`);
      }

      // 4. Tester l'instanciation
      const interpreter = interpret(machine);
      interpreter.start();
      const snapshot = interpreter.getSnapshot();
      interpreter.stop();

      // 5. Vérifier que l'état initial est valide
      if (!snapshot.value) {
        throw new Error('Machine failed to start with valid initial state');
      }

    } catch (error) {
      throw new Error(`XState machine validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Calcule le hash d'une machine pour détecter les changements
   */
  private calculateMachineHash(machine: any): string {
    console.log('🔍 [DEBUG] Machine type for hash:', typeof machine);
    console.log('🔍 [DEBUG] Machine.config type:', typeof machine.config);
    const machineString = JSON.stringify(machine.config);
    console.log('🔍 [DEBUG] Machine config stringified, length:', machineString.length);
    return crypto.createHash('md5').update(machineString).digest('hex');
  }

  /**
   * Sérialise une machine XState pour stockage en BDD
   */
  private serializeMachine(machine: any): Record<string, any> {
    return machine.config;
  }

  /**
   * Désérialise une machine XState depuis la BDD
   */
  private deserializeMachine(serializedMachine: Record<string, any>): any {
    return createMachine(serializedMachine);
  }

  /**
   * Compte le nombre de sessions actives pour un agent
   */
  private async getActiveSessionsCount(agentType: string): Promise<number> {
    try {
      const activeSessions = await this.database.getActiveSessions();
      // Gérer le cas où getActiveSessions retourne undefined/null
      if (!activeSessions || !Array.isArray(activeSessions)) {
        console.log('🔍 [DEBUG] No active sessions or invalid result from database');
        return 0;
      }
      return activeSessions.filter(session => session.agent_directeur_type === agentType).length;
    } catch (error) {
      console.error('❌ [DEBUG] Error getting active sessions count:', error);
      return 0; // Valeur par défaut sûre
    }
  }

  /**
   * Recharge tous les agents depuis la BDD au démarrage
   */
  async loadAllAgents(): Promise<void> {
    const agents = await this.database.getRegisteredAgents({ status: 'active' });
    
    for (const agent of agents) {
      if (agent.machine_definition) {
        try {
          const machine = this.deserializeMachine(agent.machine_definition);
          this.machineDefinitions.set(agent.type, {
            machine,
            metadata: {
              name: agent.name,
              description: agent.description,
              version: agent.version
            }
          });
        } catch (error) {
          // Ne pas logger pendant les tests
          if (process.env.NODE_ENV !== 'test') {
            console.error(`Failed to load agent ${agent.type}:`, error);
          }
          // Marquer l'agent comme en erreur
          await this.database.updateAgentStatus(agent.id, 'error', 
            `Failed to load machine: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    // Ne pas logger pendant les tests
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Loaded ${this.machineDefinitions.size} agents into factory`);
    }
  }

  /**
   * Obtient les statistiques de la factory
   */
  getStats(): {
    total_agents: number;
    loaded_agents: number;
    agents_by_status: Record<string, number>;
  } {
    return {
      total_agents: this.machineDefinitions.size,
      loaded_agents: this.machineDefinitions.size,
      agents_by_status: {
        active: this.machineDefinitions.size
      }
    };
  }
} 