import { Command } from 'commander';

/**
 * Commande directive agent pour gérer les agents directeurs
 * Note: La fonctionnalité de listage a été déplacée vers 'directive list agents'
 */
export const agentCommand = new Command('agent')
  .description('Manage directive agents (deprecated: use directive list agents instead)');

// Note: Cette commande est maintenant vide car ses fonctionnalités ont été déplacées :
// - agent list → list agents
// - agent create → create agent
//
// Cette commande reste temporairement pour la compatibilité descendante
// Elle sera supprimée dans une future version 