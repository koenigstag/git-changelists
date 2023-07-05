import { WorkspaceFolder } from 'vscode';
import { GitManager } from '../modules/GitManager';

export class Store {
  isGitRepoFound: boolean = false;
  gitProjectFolders: Map<string, string[]> = new Map();

  checkGitInitialized(path?: string) {
    const inited = GitManager.isGitInitialized(path);

    this.isGitRepoFound = inited;
  }

  async initGitProjectFolders(workspaceFolders: readonly WorkspaceFolder[]) {
    for (const wspace of workspaceFolders) {
      const path = wspace.uri.fsPath;

      const folders = await GitManager.getProjectFoldersWithGit(path);

      if (folders.length > 0) {
        this.gitProjectFolders.set(wspace.name, folders);
      }
    }

    if (this.gitProjectFolders.size > 0) {
      this.isGitRepoFound = true;
    }
  }
}

export const store = new Store();
