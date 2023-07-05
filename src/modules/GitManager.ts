import { execSync } from 'child_process';
import { WorkspaceManager } from './WorkspaceManager';
import { addGitToPath, removeGitFromPath } from '../utils/string.utils';
import { glob } from 'glob';
import { globAsync } from '../utils/files.utils';
import { store } from '../core/store';

export class GitManager {
  static isGitInitialized(path?: string) {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        encoding: 'utf-8',
        cwd: path,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static getLegacyGitRepoPath(): string {
    const gitProjectsMap = store.gitProjectFolders ?? new Map();
    const firstWorkspace = Array.from(gitProjectsMap.entries());
    const name = firstWorkspace[0]?.[0] ?? '';
    const gitProjectPaths = firstWorkspace[0]?.[1] ?? [];

    const gitRootPath = addGitToPath(gitProjectPaths?.[0]);

    return gitRootPath;
  }

  static async findGitRepoFoldersRecursively(path: string): Promise<string[]> {
    try {
      const gitRepos = await globAsync(`**/.git`, {
        cwd: path,
        absolute: true,
        follow: false,
      });

      return gitRepos;
    } catch (error) {
      return [];
    }
  }

  static async getInitializedGitRepos(path: string): Promise<string[]> {
    const probablyGitRepos = await this.findGitRepoFoldersRecursively(path);

    const gitRepos = probablyGitRepos.filter((repo) =>
      this.isGitInitialized(repo)
    );

    return gitRepos;
  }

  static async getProjectFoldersWithGit(path: string): Promise<string[]> {
    const gitRepos = await this.getInitializedGitRepos(path);

    const gitProjectFolders = gitRepos.map(removeGitFromPath);

    return gitProjectFolders;
  }
}
