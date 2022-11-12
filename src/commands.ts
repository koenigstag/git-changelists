import * as child from 'child_process';
import * as vscode from 'vscode';
import { Key } from './ChangelistProvider';
import { ChangeListView } from './ChangelistView';
import { noFilesPlaceholder } from './constants';
import { cannotReadContent, cannotWriteContent } from './constants/messages';

function registerCommands(options: {
  viewInstance: ChangeListView;
  context: vscode.ExtensionContext;
  logger: vscode.OutputChannel;
}) {
  const { viewInstance, context, logger } = options;

  const disposable = vscode.commands.registerCommand(
    'git-changelists.init',
    async () => {
      logger.appendLine(`command: git-changelists.init`);

      let lines;

      try {
        lines = await viewInstance.parser.getExcludeContentLines();
      } catch (error) {
        vscode.window.showErrorMessage(cannotReadContent);

        return;
      }

      if (!viewInstance.parser.checkIfWorkzoneExists(lines)) {
        vscode.window.showInformationMessage('Initializing git-changelists!');

        try {
          await viewInstance.initExcludeFile();
        } catch (error) {
          vscode.window.showErrorMessage(cannotWriteContent);
        }
      }
    }
  );
  context.subscriptions.push(disposable);

  vscode.commands.registerCommand(
    `${viewInstance.config.id}.refresh`,
    async () => {
      logger.appendLine(`command: ${viewInstance.config.id}.refresh`);

      let lines: string[] = [];
      try {
        lines = await viewInstance.parser.getExcludeContentLines();
      } catch (error) {
        vscode.window.showErrorMessage(cannotReadContent);
      }

      if (!viewInstance.parser.checkIfWorkzoneExists(lines)) {
        const choice = await vscode.window.showQuickPick(['Yes', 'No, later'], {
          title:
            'Would you like to initialize Git Changelists ? \nYou can do it later using command "Initialize Git Changelists"',
        });
  
        if (choice === 'Yes') {
          try {
            await viewInstance.initExcludeFile();
          } catch (error) {
            vscode.window.showErrorMessage(cannotWriteContent);
          }
        }
      } else {
        await viewInstance.refresh(true);
      }
    }
  );

  vscode.commands.registerCommand(
    `${viewInstance.config.id}.createNew`,
    async () => {
      logger.appendLine(`command: ${viewInstance.config.id}.createNew`);

      const value = await vscode.window.showInputBox({
        placeHolder: 'New Changelist name',
        prompt: 'Enter new Changelist unique name',
        value: '',
      });

      if (!value) {
        vscode.window.showErrorMessage(
          'A Changelist name is mandatory to execute this action'
        );

        return;
      }

      if (Object.keys(ChangeListView.tree).includes(value)) {
        vscode.window.showErrorMessage(
          'Changelist with such name already exists'
        );
        return;
      }

      viewInstance.addNewChangelist(value);

      await viewInstance.onTreeChange();
    }
  );

  vscode.commands.registerCommand(
    `${viewInstance.config.id}.rename`,
    async (node: Key) => {
      logger.appendLine(`command: ${viewInstance.config.id}.rename`);

      const value = await vscode.window.showInputBox({
        placeHolder: 'New Changelist name',
        prompt: 'Rename Changelist',
        value: '',
      });

      if (!value) {
        vscode.window.showErrorMessage(
          'A Changelist name is mandatory to execute this action'
        );

        return;
      }

      if (Object.keys(ChangeListView.tree).includes(value)) {
        vscode.window.showErrorMessage(
          'Changelist with such name already exists'
        );
        return;
      }

      viewInstance.renameChangelist(node.key, value);

      await viewInstance.onTreeChange();
    }
  );

  vscode.commands.registerCommand(
    `${viewInstance.config.id}.removeChangeList`,
    async (node: Key) => {
      logger.appendLine(`command: ${viewInstance.config.id}.removeChangeList`);

      const value = ChangeListView.tree[node.key];

      viewInstance.removeChangelist(node.key);

      await viewInstance.onTreeChange();

      const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      Object.keys(value).forEach((fileName) => {
        try {
          const stdout = child.execSync(
            'git update-index --no-assume-unchanged ' + fileName,
            {
              cwd: wsPath,
              encoding: 'utf8',
            }
          );

          console.log(stdout.toString());
        } catch (error) {}
      });
    }
  );

  vscode.commands.registerCommand(
    `${viewInstance.config.id}.removeFile`,
    async (node: Key) => {
      logger.appendLine(`command: ${viewInstance.config.id}.removeFile`);

      const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      const fileName = node.key;

      if (fileName === noFilesPlaceholder) {
        return;
      }

      const changelistName = Object.keys(ChangeListView.tree).find((name) =>
        Object.keys(ChangeListView.tree[name]).includes(fileName)
      );

      if (!changelistName) {
        vscode.window.showErrorMessage('Changelist not found');
        return;
      }

      if (Object.keys(ChangeListView.tree[changelistName]).length === 1) {
        viewInstance.addFileToChangelist(changelistName, 'No files');
      }

      viewInstance.removeFileFromChangelist(changelistName, fileName);

      await viewInstance.onTreeChange();

      let text =
        '{file} is restored from the state assumed to be unchanged.'.replace(
          '{file}',
          fileName
        );
      vscode.window.showInformationMessage(text);
      try {
        const stdout = child.execSync(
          'git update-index --no-assume-unchanged ' + fileName,
          {
            cwd: wsPath,
            encoding: 'utf8',
          }
        );

        console.log(stdout.toString());
      } catch (error) {}
    }
  );

  vscode.commands.registerCommand(
    `${viewInstance.config.id}.addFileToChangelist`,
    async (node) => {
      logger.appendLine(
        `command: ${viewInstance.config.id}.addFileToChangelist`
      );

      const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      const relativePath = node.resourceUri.fsPath.replace(wsPath, '');

      const changelistName = await vscode.window.showQuickPick(
        Object.keys(ChangeListView.tree),
        { title: 'Select Changelist where you want to add file' }
      );

      if (!changelistName) {
        vscode.window.showErrorMessage(
          'A Changelist name is mandatory to execute this action'
        );

        return;
      }

      const fileName =
        relativePath.startsWith('/') || relativePath.startsWith('\\')
          ? relativePath.slice(1)
          : relativePath;

      if (!changelistName) {
        vscode.window.showErrorMessage('Changelist not found');
        return;
      }

      viewInstance.addFileToChangelist(changelistName, fileName);

      await viewInstance.onTreeChange();

      if (!viewInstance.isUntracked(node)) {
        let text = '{file} is assumed to be unchanged.'.replace(
          '{file}',
          fileName
        );
        vscode.window.showInformationMessage(text);
        try {
          const stdout = child.execSync(
            'git update-index --assume-unchanged ' + fileName,
            {
              cwd: wsPath,
              encoding: 'utf8',
            }
          );

          console.log(stdout.toString());
        } catch (error) {}
      }
    }
  );
}

export default registerCommands;
