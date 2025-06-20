# Implementations - Implémentations Concrètes

Ce répertoire contient toutes les implémentations concrètes des interfaces abstraites.

## Structure

- **database/** : Implémentations des services de base de données
  - `json-database.impl.ts` : Base de données JSON locale (MVP)
  - `postgres-database.impl.ts` : Base de données PostgreSQL (production)

- **iam/** : Implémentations des services IAM
  - `mock-iam.impl.ts` : Service IAM mock (MVP/développement)
  - `auth0-iam.impl.ts` : Intégration Auth0 (production)

- **ai-resources/** : Implémentations des services IA
  - `openai-resources.impl.ts` : Intégration OpenAI

- **rag/** : Implémentations des services RAG
  - `vector-rag.impl.ts` : RAG basé sur des embeddings vectoriels

## Principe

Chaque implémentation respecte les contrats définis dans `src/interfaces/` et peut être échangée facilement selon l'environnement ou les besoins. 