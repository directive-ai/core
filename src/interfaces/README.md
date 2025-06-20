# Interfaces - Contrats Abstraits

Ce répertoire contient toutes les interfaces abstraites du système Directive.

## Interfaces disponibles

- **database.interface.ts** : Contrat pour les services de base de données
- **iam.interface.ts** : Contrat pour les services d'authentification et autorisation
- **ai-resources.interface.ts** : Contrat pour les services d'IA et modèles
- **rag.interface.ts** : Contrat pour les services RAG (Retrieval-Augmented Generation)

## Objectif

Ces interfaces permettent :
- Une architecture découplée et modulaire
- L'implémentation de différents providers selon l'environnement
- La facilité de tests avec des implémentations mock
- L'extensibilité future du système

## Usage

Toutes les interfaces sont injectées via le système de dépendances de Nest.js et implémentées dans `src/implementations/`. 