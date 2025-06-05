export const workspaceNotFound =
  'Workspace not found. Please open folder before using';
export const workspaceNotTrusted = 'Workspace is not trusted';
export const gitRepoNotFound =
  "Git repository not found. Try run 'git init' before using";

export const cannotReadContent = 'Cannot read changelists from file';

export const cannotWriteContent = 'Cannot write changelists to file';

export const askToInitExtFiles =
  'Would you like to initialize Git Changelists ? \nYou can do it later using command "Initialize Git Changelists"';
export enum AskToInitAnswers {
  yes = 'Yes',
  no = 'No, later',
}

export const initializingExtFiles = 'Initializing git-changelists!';

export const changelistNameMandatory =
  'A Changelist name is mandatory to execute this action';

export const changelistNameAlreadyExists =
  'Changelist with such name already exists';

export const changelistNotFound = 'Changelist not found';

export const fileWasRestored =
  '{file} is restored from the state assumed to be unchanged.';

export const fileAssumedUnchanged = '{file} is assumed to be unchanged.';

export const fileWasAddedToChangelist =
  'File was added to "{changelist}" changelist.';

export const fileWasRemovedFromChangelist =
  'File was removed from "{changelist}" changelist.';

export const selectChangelistToAddFile =
  'Select Changelist where you want to add file';

export const newChangelistPlaceholder = 'New Changelist name';

export const renameChangelist = 'Rename Changelist';

export const enterUniqueChangelistName = 'Enter new Changelist unique name';
