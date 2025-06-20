# Core - Noyau Directive

Ce répertoire contient les composants principaux du noyau Directive :

## Structure

- **session-broker/** : Orchestrateur de sessions - gère le cycle de vie des sessions et l'orchestration des agents
- **agent-factory/** : Factory des agents directeurs - gestion et création des instances d'agents
- **agent-engine/** : Moteur XState - exécution des machines à état des agents

## Responsabilités

Le noyau Directive est responsable de :
- La gestion des sessions utilisateur
- L'orchestration des agents directeurs
- L'exécution des machines à état XState
- La communication entre les différents composants

## Architecture

Ces composants forment le cœur de l'architecture Directive et utilisent les interfaces abstraites définies dans `src/interfaces/`. 