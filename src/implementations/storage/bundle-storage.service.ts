import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export interface BundleMetadata {
  buildHash: string;
  buildTime: string;
  dependencies: Record<string, string>;
  gitCommit?: string;
  uploadedAt: string;
  uploadedBy: string;
  fileSize: number;
  originalName: string;
}

export interface StoredVersion {
  id: string;
  agentId: string;
  version: string;
  bundleSize: number;
  deployedAt: string;
  status: 'active' | 'inactive';
  metadata: BundleMetadata;
  bundlePath: string;
  metadataPath: string;
}

/**
 * Service de gestion du stockage des bundles d'agents
 * 
 * Structure de stockage :
 * data/deployments/
 * ├── agents/
 * │   ├── {agentId}/
 * │   │   ├── versions/
 * │   │   │   ├── 1.0.0/
 * │   │   │   │   ├── bundle.js
 * │   │   │   │   └── metadata.json
 * │   │   │   └── 1.1.0/
 * │   │   ├── active -> versions/1.1.0/
 * │   │   └── versions.json
 */
export class BundleStorageService {
  private readonly baseDir: string;

  constructor(baseDir = 'data/deployments') {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Stocke un nouveau bundle d'agent avec versioning
   */
  async storeBundle(
    agentId: string,
    version: string,
    bundleBuffer: Buffer,
    metadata: BundleMetadata,
    force = false
  ): Promise<{
    success: boolean;
    versionPath: string;
    bundlePath: string;
    previousVersion?: string;
    message: string;
  }> {
    try {
      // 1. Créer la structure de dossiers
      const agentDir = path.join(this.baseDir, 'agents', agentId);
      const versionsDir = path.join(agentDir, 'versions');
      const versionDir = path.join(versionsDir, version);
      
      await fs.mkdir(versionDir, { recursive: true });

      // 2. Vérifier si la version existe déjà
      const bundlePath = path.join(versionDir, 'bundle.js');
      const metadataPath = path.join(versionDir, 'metadata.json');

      if (existsSync(bundlePath) && !force) {
        throw new Error(`Version ${version} already exists for agent ${agentId}. Use force=true to overwrite.`);
      }

      // 3. Obtenir la version précédente (pour rollback)
      const previousVersion = await this.getCurrentVersion(agentId);

      // 4. Sauvegarder le bundle
      await fs.writeFile(bundlePath, bundleBuffer);

      // 5. Sauvegarder les métadonnées
      const fullMetadata = {
        ...metadata,
        version,
        agentId,
        bundlePath,
        metadataPath
      };
      await fs.writeFile(metadataPath, JSON.stringify(fullMetadata, null, 2));

      // 6. Mettre à jour la version active (symlink)
      await this.setActiveVersion(agentId, version);

      // 7. Mettre à jour le registre des versions
      await this.updateVersionRegistry(agentId, version, metadata);

      return {
        success: true,
        versionPath: versionDir,
        bundlePath,
        previousVersion,
        message: `Bundle stored successfully for agent ${agentId} version ${version}`
      };

    } catch (error) {
      return {
        success: false,
        versionPath: '',
        bundlePath: '',
        message: `Failed to store bundle: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Récupère la version actuellement active
   */
  async getCurrentVersion(agentId: string): Promise<string | undefined> {
    try {
      const agentDir = path.join(this.baseDir, 'agents', agentId);
      const activeLinkPath = path.join(agentDir, 'active');
      
      if (!existsSync(activeLinkPath)) {
        return undefined;
      }

      // Lire le symlink pour obtenir le chemin de la version active
      const symlinkTarget = await fs.readlink(activeLinkPath);
      // symlinkTarget sera quelque chose comme "versions/1.0.0"
      const version = path.basename(symlinkTarget);
      return version;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Définit une version comme active (symlink)
   */
  async setActiveVersion(agentId: string, version: string): Promise<void> {
    const agentDir = path.join(this.baseDir, 'agents', agentId);
    const activeLinkPath = path.join(agentDir, 'active');
    const targetPath = path.join('versions', version);

    // Supprimer le symlink existant s'il existe
    if (existsSync(activeLinkPath)) {
      await fs.unlink(activeLinkPath);
    }

    // Créer le nouveau symlink
    await fs.symlink(targetPath, activeLinkPath);
  }

  /**
   * Récupère toutes les versions d'un agent
   */
  async getAgentVersions(agentId: string): Promise<StoredVersion[]> {
    try {
      const versionsDir = path.join(this.baseDir, 'agents', agentId, 'versions');
      
      if (!existsSync(versionsDir)) {
        return [];
      }

      const versionDirs = await fs.readdir(versionsDir);
      const currentVersion = await this.getCurrentVersion(agentId);
      
      const versions: StoredVersion[] = [];

      for (const versionDir of versionDirs) {
        const versionPath = path.join(versionsDir, versionDir);
        const metadataPath = path.join(versionPath, 'metadata.json');
        const bundlePath = path.join(versionPath, 'bundle.js');

        if (!existsSync(metadataPath) || !existsSync(bundlePath)) {
          continue;
        }

        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          const bundleStats = await fs.stat(bundlePath);

          versions.push({
            id: `version_${agentId}_${versionDir}`,
            agentId,
            version: versionDir,
            bundleSize: bundleStats.size,
            deployedAt: metadata.uploadedAt,
            status: currentVersion === versionDir ? 'active' : 'inactive',
            metadata,
            bundlePath,
            metadataPath
          });
        } catch (error) {
          // Ignorer les versions avec métadonnées corrompues
          continue;
        }
      }

      // Trier par date de déploiement (plus récent en premier)
      versions.sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());

      return versions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Effectue un rollback vers une version spécifique
   */
  async rollbackToVersion(agentId: string, targetVersion: string): Promise<{
    success: boolean;
    previousVersion?: string;
    newVersion: string;
    message: string;
  }> {
    try {
      // 1. Vérifier que la version cible existe
      const versionPath = path.join(this.baseDir, 'agents', agentId, 'versions', targetVersion);
      
      if (!existsSync(versionPath)) {
        throw new Error(`Version ${targetVersion} does not exist for agent ${agentId}`);
      }

      // 2. Obtenir la version précédente
      const previousVersion = await this.getCurrentVersion(agentId);

      // 3. Changer le symlink vers la version cible
      await this.setActiveVersion(agentId, targetVersion);

      return {
        success: true,
        previousVersion,
        newVersion: targetVersion,
        message: `Successfully rolled back agent ${agentId} from ${previousVersion} to ${targetVersion}`
      };
    } catch (error) {
      return {
        success: false,
        newVersion: targetVersion,
        message: `Failed to rollback: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Met à jour le registre des versions (fichier versions.json)
   */
  private async updateVersionRegistry(agentId: string, version: string, metadata: BundleMetadata): Promise<void> {
    try {
      const agentDir = path.join(this.baseDir, 'agents', agentId);
      const registryPath = path.join(agentDir, 'versions.json');
      
      let registry: any = {};
      
      // Charger le registre existant
      if (existsSync(registryPath)) {
        const registryContent = await fs.readFile(registryPath, 'utf-8');
        registry = JSON.parse(registryContent);
      }

      // Ajouter/mettre à jour cette version
      registry[version] = {
        uploadedAt: metadata.uploadedAt,
        buildHash: metadata.buildHash,
        fileSize: metadata.fileSize,
        gitCommit: metadata.gitCommit
      };

      // Sauvegarder le registre
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
    } catch (error) {
      // Non critique, ignorer
    }
  }

  /**
   * Supprime une version spécifique
   */
  async deleteVersion(agentId: string, version: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const versionPath = path.join(this.baseDir, 'agents', agentId, 'versions', version);
      
      if (!existsSync(versionPath)) {
        throw new Error(`Version ${version} does not exist`);
      }

      // Vérifier que ce n'est pas la version active
      const currentVersion = await this.getCurrentVersion(agentId);
      if (currentVersion === version) {
        throw new Error(`Cannot delete active version ${version}. Rollback to another version first.`);
      }

      // Supprimer le dossier de version
      await fs.rm(versionPath, { recursive: true });

      return {
        success: true,
        message: `Version ${version} deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete version: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Nettoie les anciennes versions (garde les N plus récentes)
   */
  async cleanupOldVersions(agentId: string, keepCount = 5): Promise<{
    success: boolean;
    deletedVersions: string[];
    message: string;
  }> {
    try {
      const versions = await this.getAgentVersions(agentId);
      const currentVersion = await this.getCurrentVersion(agentId);
      
      // Filtrer les versions à supprimer (garder les keepCount plus récentes + version active)
      const versionsToDelete = versions
        .filter(v => v.status !== 'active')
        .slice(keepCount)
        .map(v => v.version);

      const deletedVersions: string[] = [];

      for (const version of versionsToDelete) {
        if (version !== currentVersion) {
          const result = await this.deleteVersion(agentId, version);
          if (result.success) {
            deletedVersions.push(version);
          }
        }
      }

      return {
        success: true,
        deletedVersions,
        message: `Cleaned up ${deletedVersions.length} old versions for agent ${agentId}`
      };
    } catch (error) {
      return {
        success: false,
        deletedVersions: [],
        message: `Failed to cleanup: ${error instanceof Error ? error.message : error}`
      };
    }
  }
} 