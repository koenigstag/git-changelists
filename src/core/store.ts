import { GitManager } from "../modules/GitManager";

export class Store {
  isGitRepoFound?: boolean = false;

  checkGitInitialized(path?: string) {
    const inited = GitManager.isGitInitialized(path);

    this.isGitRepoFound = inited;
  }
}

export const store = new Store();
