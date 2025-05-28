import { execSync } from 'child_process';
import { WorkspaceManager } from './WorkspaceManager';
import { addGitToPath, contentToLines } from '../utils/string.utils';
import { GitCommandsManager } from './GitCommands';
import { GitCommandNamesEnum } from '../enum/git-commands.enum';
import { resolve } from 'path';
import { Uri, workspace } from 'vscode';

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

  static async getGitStatus(gitFolderPath: Uri): Promise<string[]> {
    try {
      const path = gitFolderPath.fsPath;
      const rootPath = path.includes('.git') ? resolve(path, '../') : path;
      const status = await GitCommandsManager.execAsync(
        GitCommandNamesEnum.status,
        rootPath,
      );

      return contentToLines(status);
    } catch (error) {
      return [];
    }
  }

  static getLegacyGitRepoPath(workspaceRootPath?: string): string {
    if (workspaceRootPath && WorkspaceManager.isWorkspaceTrusted) {
      return addGitToPath(workspaceRootPath);
    }

    return addGitToPath('');
  }

  static findGitRepoFoldersRecursively(path: string, depth = 3): string[] {
    return [];
  }

  static findGitRepos(path: string): string[] {
    const probablyGitRepos = this.findGitRepoFoldersRecursively(path);

    const gitRepos = probablyGitRepos.filter((repo) =>
      this.isGitInitialized(repo)
    );

    return gitRepos;
  }
}
