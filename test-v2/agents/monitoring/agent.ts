import { createMachine, assign } from 'xstate';

/**
 * Agent de surveillance système
 * 
 * Type: test-v2/monitoring
 * Author: DevOps Team
 * Architecture: Directive v2.0 (simplified)
 */

export interface MonitoringContext {
  // Définir les données du contexte ici
  currentState: string;
  requestData?: any;
  result?: any;
  error?: string;
}

export type MonitoringEvent = 
  | { type: 'START'; data?: any }
  | { type: 'PROCESS'; payload: any }
  | { type: 'SUCCESS'; result: any }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

/**
 * Machine XState pour l'agent monitoring
 * 
 * États disponibles:
 * - idle: État initial, en attente
 * - processing: Traitement en cours
 * - success: Traitement réussi
 * - error: Erreur rencontrée
 */
export const monitoringMachine = createMachine({
  id: 'monitoring',
  initial: 'idle',
  context: {
    currentState: 'idle',
    requestData: null,
    result: null,
    error: null
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'processing',
          actions: assign({
            currentState: 'processing',
            requestData: ({ event }) => event.data,
            error: null
          })
        }
      }
    },
    processing: {
      on: {
        SUCCESS: {
          target: 'success',
          actions: assign({
            currentState: 'success',
            result: ({ event }) => event.result,
            error: null
          })
        },
        ERROR: {
          target: 'error',
          actions: assign({
            currentState: 'error',
            error: ({ event }) => event.error
          })
        }
      }
    },
    success: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            currentState: 'idle',
            requestData: null,
            result: null,
            error: null
          })
        }
      }
    },
    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            currentState: 'idle',
            requestData: null,
            result: null,
            error: null
          })
        }
      }
    }
  }
});