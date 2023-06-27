import { window, commands, ExtensionContext } from 'vscode';
import { Key } from './ChangelistProvider';
import { ChangeListView } from './ChangelistView';
import { getWorkspaceRootPath, noFilesPlaceholder } from './constants';
import {
  cannotWriteContent,
  changelistNameAlreadyExists,
  changelistNameMandatory,
  changelistNotFound,
  enterUniqueChangelistName,
  fileAssumedUnchanged,
  fileWasRestored,
  gitRepoNotFound,
  initializingExtFiles,
  newChangelistPlaceholder,
  renameChangelist,
  selectChagelistToAddFile,
  workspaceNotFound,
  workspaceNotTrusted,
} from './constants/messages';
import { logger } from './logger';
import { store } from './store';
import { childExecAsync } from './utils';

const gitCommands = {
  add: (...files: string[]) => `git add ${files.join(' ')}`,
  addForce: (...files: string[]) => `git add -f ${files.join(' ')}`,
  assumeUnchanged: (...files: string[]) =>
    `git update-index --assume-unchanged ${files.join(' ')}`,
  noAssumeUnchanged: (...files: string[]) =>
    `git update-index --no-assume-unchanged ${files.join(' ')}`,
};

const gitExecComands = {
  add:
    (...files: string[]) =>
    (cwd?: string) =>
      childExecAsync(gitCommands.add(...files), cwd),
  addForce:
    (...files: string[]) =>
    (cwd?: string) =>
      childExecAsync(gitCommands.addForce(...files), cwd),
  assumeUnchanged:
    (...files: string[]) =>
    (cwd?: string) =>
      childExecAsync(gitCommands.assumeUnchanged(...files), cwd),
  noAssumeUnchanged:
    (...files: string[]) =>
    (cwd?: string) =>
      childExecAsync(gitCommands.noAssumeUnchanged(...files), cwd),
};

const extComands = {
  extName: 'git-changelists',
  prefix: '',
  get init() {
    return `${this.extName}.init`;
  },
  get refresh() {
    return `${this.prefix}.refresh`;
  },
  get createNew() {
    return `${this.prefix}.createNew`;
  },
  get rename() {
    return `${this.prefix}.rename`;
  },
  get removeChangeList() {
    return `${this.prefix}.removeChangeList`;
  },
  get stageChangeList() {
    return `${this.prefix}.stageChangeList`;
  },
  get removeFile() {
    return `${this.prefix}.removeFile`;
  },
  get addFileToChangelist() {
    return `${this.prefix}.addFileToChangelist`;
  },
  get stageFile() {
    return `${this.prefix}.stageFile`;
  },
};

async function checkPrerequisites(
  viewInstance: ChangeListView,
  checkExcludeInitialized = true
) {
  if (!store.workspaceFound) {
    window.showErrorMessage(workspaceNotFound);
    return false;
  } else if (!store.workspaceIsTrusted) {
    window.showErrorMessage(workspaceNotTrusted);
    return false;
  } else if (checkExcludeInitialized) {
    try {
      if (!(await viewInstance.isExcludeInitialized())) {
        return await viewInstance.askToInitExcludeFile();
      }
    } catch (error) {
      return false;
    }
  } else if (!store.gitRepoFound) {
    window.showErrorMessage(gitRepoNotFound);
    return false;
  }

  return true;
}

const registerCommand = (
  command: string,
  viewInstance: ChangeListView,
  handler: (param: any) => Promise<void>
) => {
  commands.registerCommand(command, async (param: any) => {
    logger.appendLine(`command: ${command}`);

    if (!(await checkPrerequisites(viewInstance, false))) {
      return;
    }

    try {
      await handler(param);

      await viewInstance.onTreeChange();
    } catch (error: unknown) {
      console.error(
        `Error while running handler of command '${command}: '`,
        error
      );
    }
  });
};

const tryExecGitCommand = async (
  command: keyof typeof gitExecComands,
  cwd: string | undefined,
  ...filePath: string[]
) => {
  console.log('Executing command: ', gitCommands[command](...filePath));

  try {
    const stdout = await gitExecComands[command]?.(...filePath)?.(cwd);

    const result = stdout.toString();

    console.log(command, 'success: true;', result);

    return { succeeded: true, result };
  } catch (error: unknown) {
    console.error(command, 'success: false;', (error as Error).message);

    return { succeeded: false, error };
  }
};

function registerCommands(options: {
  viewInstance: ChangeListView;
  context: ExtensionContext;
}) {
  const { viewInstance, context } = options;

  extComands.prefix = viewInstance.config.id;

  const wsPath = getWorkspaceRootPath();

  registerCommand(extComands.init, viewInstance, async () => {
    window.showInformationMessage(initializingExtFiles);

    try {
      await viewInstance.initExcludeFile();
    } catch (error: any) {
      logger.appendLine(`Error: [initExcludeFile] ${error.message}`);
      window.showErrorMessage(cannotWriteContent);
    }
  });

  registerCommand(extComands.refresh, viewInstance, async () => {
    await viewInstance.refresh(true);
  });

  registerCommand(extComands.createNew, viewInstance, async () => {
    const newChangelistName = await window.showInputBox({
      placeHolder: newChangelistPlaceholder,
      prompt: enterUniqueChangelistName,
      value: '',
    });

    if (!newChangelistName) {
      window.showErrorMessage(changelistNameMandatory);

      return;
    }

    if (Object.keys(ChangeListView.tree).includes(newChangelistName)) {
      window.showErrorMessage(changelistNameAlreadyExists);
      return;
    }

    viewInstance.addNewChangelist(newChangelistName);
  });

  registerCommand(extComands.rename, viewInstance, async (node: Key) => {
    if (!node) {
      return;
    }

    const prevName = node.key;

    const newName = await window.showInputBox({
      placeHolder: newChangelistPlaceholder,
      prompt: renameChangelist,
      value: prevName,
    });

    if (!newName) {
      window.showErrorMessage(changelistNameMandatory);

      return;
    }

    if (Object.keys(ChangeListView.tree).includes(newName)) {
      window.showErrorMessage(changelistNameAlreadyExists);
      return;
    }

    viewInstance.renameChangelist(prevName, newName);
  });

  registerCommand(
    extComands.removeChangeList,
    viewInstance,
    async (node: Key) => {
      if (!node) {
        return;
      }

      const changelistName = viewInstance.transformChangelistName(node.key);

      const files = ChangeListView.tree[changelistName];

      viewInstance.removeChangelist(changelistName);

      const status = await viewInstance.parser.getGitStatus();

      await Promise.all(
        Object.keys(files).map(async (fileName) => {
          if (!(await viewInstance.isUntracked(fileName, status))) {
            await tryExecGitCommand('noAssumeUnchanged', wsPath, fileName);
          }
        })
      );
    }
  );

  registerCommand(
    extComands.stageChangeList,
    viewInstance,
    async (node: Key) => {
      if (!node) {
        return;
      }

      const changelistName = viewInstance.transformChangelistName(node.key);

      const files = ChangeListView.tree[changelistName];

      const filePaths = Object.keys(files);

      const status = await viewInstance.parser.getGitStatus();

      await Promise.all(
        Object.keys(files).map(async (fileName) => {
          viewInstance.removeFileFromChangelist(changelistName, fileName);

          if (!(await viewInstance.isUntracked(fileName, status))) {
            await tryExecGitCommand('noAssumeUnchanged', wsPath, fileName);
          }
        })
      );

      await viewInstance.onTreeChange();

      await tryExecGitCommand('addForce', wsPath, ...filePaths);
    }
  );

  registerCommand(extComands.removeFile, viewInstance, async (node: Key) => {
    if (!node) {
      return;
    }

    const fileName = node.key;

    if (fileName === noFilesPlaceholder) {
      return;
    }

    const changelistName = Object.keys(ChangeListView.tree).find((name) =>
      Object.keys(ChangeListView.tree[name]).includes(fileName)
    );

    if (!changelistName) {
      window.showErrorMessage(changelistNotFound);
      return;
    }

    if (Object.keys(ChangeListView.tree[changelistName]).length === 1) {
      // viewInstance.addFileToChangelist(changelistName, noFilesPlaceholder);
    }

    viewInstance.removeFileFromChangelist(changelistName, fileName);

    await viewInstance.onTreeChange();

    if (!(await viewInstance.isUntracked(fileName))) {
      const result = await tryExecGitCommand(
        'noAssumeUnchanged',
        wsPath,
        fileName
      );

      if (result.succeeded) {
        const text = fileWasRestored.replace('{file}', fileName);
        window.showInformationMessage(text);
      }
    }
  });

  registerCommand(extComands.stageFile, viewInstance, async (node: Key) => {
    if (!node) {
      return;
    }

    const fileName = node.key;

    if (fileName === noFilesPlaceholder) {
      return;
    }

    const changelistName = Object.keys(ChangeListView.tree).find((name) =>
      Object.keys(ChangeListView.tree[name]).includes(fileName)
    );

    if (!changelistName) {
      window.showErrorMessage(changelistNotFound);
      return;
    }

    if (Object.keys(ChangeListView.tree[changelistName]).length === 1) {
      // viewInstance.addFileToChangelist(changelistName, noFilesPlaceholder);
    }

    viewInstance.removeFileFromChangelist(changelistName, fileName);

    await viewInstance.onTreeChange();

    if (!(await viewInstance.isUntracked(fileName))) {
      const result = await tryExecGitCommand(
        'noAssumeUnchanged',
        wsPath,
        fileName
      );

      if (result.succeeded) {
        const text = fileWasRestored.replace('{file}', fileName);
        window.showInformationMessage(text);
      }
    }

    await tryExecGitCommand('addForce', wsPath, fileName);
  });

  registerCommand(
    extComands.addFileToChangelist,
    viewInstance,
    async (node) => {
      if (!node) {
        return;
      }

      const relativePath = node.resourceUri.fsPath.replace(wsPath, '');

      const changelistName = await window.showQuickPick(
        Object.keys(ChangeListView.tree),
        { title: selectChagelistToAddFile }
      );

      if (!changelistName) {
        window.showErrorMessage(changelistNameMandatory);

        return;
      }

      const fileName =
        relativePath.startsWith('/') || relativePath.startsWith('\\')
          ? relativePath.slice(1)
          : relativePath;

      if (!changelistName) {
        window.showErrorMessage(changelistNotFound);
        return;
      }

      viewInstance.addFileToChangelist(changelistName, fileName);

      if (!(await viewInstance.isUntracked(fileName))) {
        const result = await tryExecGitCommand(
          'assumeUnchanged',
          wsPath,
          fileName
        );

        if (result.succeeded) {
          const text = fileAssumedUnchanged.replace('{file}', fileName);
          window.showInformationMessage(text);
        }
      }
    }
  );
}

export default registerCommands;
