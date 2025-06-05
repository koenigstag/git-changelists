import { window, commands, ExtensionContext } from 'vscode';
import { Key } from '../view/ChangelistProvider';
import { ChangeListView } from '../view/ChangelistView';
import { noFilesPlaceholder } from '../constants';
import {
  cannotWriteContent,
  changelistNameAlreadyExists,
  changelistNameMandatory,
  changelistNotFound,
  enterUniqueChangelistName,
  fileWasAddedToChangelist,
  fileWasRemovedFromChangelist,
  gitRepoNotFound,
  initializingExtFiles,
  newChangelistPlaceholder,
  renameChangelist,
  selectChangelistToAddFile,
  workspaceNotFound,
  workspaceNotTrusted,
} from '../constants/messages';
import { logger } from './logger';
import { store } from './store';
import { WorkspaceManager } from '../modules/WorkspaceManager';
import { extComands } from '../constants/extension';
import { GitCommandNamesEnum } from '../enum/git-commands.enum';
import { GitCommandsManager } from '../modules/GitCommands';

async function checkPrerequisites(
  viewInstance: ChangeListView,
  checkExcludeInitialized = true
) {
  if (!WorkspaceManager.isWorkspaceFound) {
    window.showErrorMessage(workspaceNotFound);
    return false;
  }

  if (!WorkspaceManager.isWorkspaceTrusted) {
    window.showErrorMessage(workspaceNotTrusted);
    return false;
  }

  store.checkGitInitialized(WorkspaceManager.workspaceRootPath);

  if (!store.isGitRepoFound) {
    window.showErrorMessage(gitRepoNotFound);
    return false;
  }

  if (checkExcludeInitialized) {
    try {
      if (!(await viewInstance.isConfigInitialized())) {
        return await viewInstance.askToInitConfigFile();
      }
    } catch (error) {
      return false;
    }
  }

  return true;
}

const registerCommand = (
  command: string,
  viewInstance: ChangeListView,
  handler: (param: any) => Promise<void>,
  options: { checkExcludeInitialized?: boolean } = {}
) => {
  commands.registerCommand(command, async (param: any) => {
    logger.appendLine(`command: ${command}`);

    if (
      !(await checkPrerequisites(
        viewInstance,
        options.checkExcludeInitialized ?? false
      ))
    ) {
      return;
    }

    try {
      await handler(param);

      await viewInstance.onTreeChange();
    } catch (error: unknown) {
      logger.appendLine(
        `[ERR] Error while running handler of command '${command}: ' ${(error as Error).message}`,
      );
    }
  });
};

function registerCommands(options: {
  viewInstance: ChangeListView;
  context: ExtensionContext;
}) {
  const { viewInstance, context } = options;

  extComands.prefix = viewInstance.config.id;

  const wsPath = WorkspaceManager.workspaceRootPath;

  registerCommand(
    extComands.init,
    viewInstance,
    async () => {
      window.showInformationMessage(initializingExtFiles);

      try {
        await viewInstance.initConfigFile();
      } catch (error: any) {
        logger.appendLine(`Error: [initExcludeFile] ${error.message}`);
        window.showErrorMessage(cannotWriteContent);
      }
    },
    {
      checkExcludeInitialized: false,
    }
  );

  registerCommand(
    extComands.refresh,
    viewInstance,
    async () => {
      await viewInstance.scheduleRefresh(true);
    },
    {
      checkExcludeInitialized: true,
    }
  );

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

    await viewInstance.addNewChangelist(newChangelistName);
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

    await viewInstance.renameChangelist(prevName, newName);
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

      await viewInstance.removeChangelist(changelistName);

      const status = await viewInstance.getGitStatus();

      if (!status.length) {
        logger.appendLine('[WARN] No git status found');
        return;
      }

      await Promise.all(
        Object.keys(files).map(async (fileName) => {
          if (!(await viewInstance.isUntracked(fileName, status))) {
            await GitCommandsManager.tryExecAsyncGitCommand(
              GitCommandNamesEnum.noAssumeUnchanged,
              wsPath,
              fileName
            );
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

      const status = await viewInstance.getGitStatus();

      if (!status.length) {
        logger.appendLine('[WARN] No git status found');
        return;
      }

      await Promise.all(
        Object.keys(files).map(async (fileName) => {
          await viewInstance.removeFileFromChangelist(changelistName, fileName);

          if (!(await viewInstance.isUntracked(fileName, status))) {
            await GitCommandsManager.tryExecAsyncGitCommand(
              GitCommandNamesEnum.noAssumeUnchanged,
              wsPath,
              fileName
            );
          }
        })
      );

      await viewInstance.onTreeChange();

      await GitCommandsManager.tryExecAsyncGitCommand(
        GitCommandNamesEnum.addForce,
        wsPath,
        ...filePaths
      );
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

    await viewInstance.removeFileFromChangelist(changelistName, fileName);

    const text = fileWasRemovedFromChangelist.replace('{file}', fileName).replace('{changelist}', changelistName);
    window.showInformationMessage(text);

    await viewInstance.onTreeChange();

    if (!(await viewInstance.isUntracked(fileName))) {
      await GitCommandsManager.tryExecAsyncGitCommand(
        GitCommandNamesEnum.noAssumeUnchanged,
        wsPath,
        fileName
      );

      // if (result.succeeded) {
      //   const text = fileWasRestored.replace('{file}', fileName);
      //   window.showInformationMessage(text);
      // }
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

    await viewInstance.removeFileFromChangelist(changelistName, fileName);

    const text = fileWasRemovedFromChangelist.replace('{file}', fileName).replace('{changelist}', changelistName);
    window.showInformationMessage(text);

    await viewInstance.onTreeChange();

    if (!(await viewInstance.isUntracked(fileName))) {
      await GitCommandsManager.tryExecAsyncGitCommand(
        GitCommandNamesEnum.noAssumeUnchanged,
        wsPath,
        fileName
      );

      // if (result.succeeded) {
      //   const text = fileWasRestored.replace('{file}', fileName);
      //   window.showInformationMessage(text);
      // }
    }

    await GitCommandsManager.tryExecAsyncGitCommand(
      GitCommandNamesEnum.addForce,
      wsPath,
      fileName
    );
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
        { title: selectChangelistToAddFile }
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

      await viewInstance.addFileToChangelist(changelistName, fileName);

      const text = fileWasAddedToChangelist.replace('{file}', fileName).replace('{changelist}', changelistName);
      window.showInformationMessage(text);

      // deprecated flow
      // if (!(await viewInstance.isUntracked(fileName))) {
      //   const result = await GitCommandsManager.tryExecAsyncGitCommand(
      //     GitCommandNamesEnum.assumeUnchanged,
      //     wsPath,
      //     fileName
      //   );

      //   if (result.succeeded) {
      //     const text = fileAssumedUnchanged.replace('{file}', fileName).replace('{changelist}', changelistName);
      //     window.showInformationMessage(text);
      //   }
      // }
    }
  );
}

export default registerCommands;
