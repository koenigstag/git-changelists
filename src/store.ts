
export const store: Store = {
  workspaceFound: undefined,
  workspaceIsTrusted: undefined,
  gitRepoFound: undefined,
};

export type Store = {
  workspaceFound?: boolean,
  workspaceIsTrusted?: boolean,
  gitRepoFound?: boolean,
};
