import * as vscode from 'vscode';
import { join } from 'path';
import { randomString } from '../utils/string.utils';
import { defaultChangelistName } from '../constants';
import { logger } from '../core/logger';
import { TreeType } from '../view/ChangelistView';
import { TextDecoder, TextEncoder } from 'util';

const getRandomId = () => randomString(10);

export class ChangelistConfig {
  public id: string;
  public name: string;
  public files: string[];
  public description?: string;
  public createdAt: string;

  public init(data: Partial<ChangelistConfig>) {
    this.id = data.id || `${getRandomId()}`;
    this.name = data.name || defaultChangelistName;
    this.files = data.files || [];
    this.description = data.description || '';
    this.createdAt = data.createdAt
      ? new Date(data.createdAt).toISOString()
      : new Date().toISOString();

    return this;
  }

  public static defaultConfig(): ChangelistConfig {
    return new ChangelistConfig().init({
      name: defaultChangelistName,
    });
  }

  public compare(prev?: ChangelistConfig | null): boolean {
    if (!prev) {
      return false;
    }

    if (this.id !== prev.id) {
      return false;
    }

    if (this.name !== prev.name) {
      return false;
    }

    if (this.files.length !== prev.files.length) {
      return false;
    }

    if (this.files.some((file, index) => file !== prev.files[index])) {
      return false;
    }

    return true;
  }
}

export class JSONConfig {
  changelists: ChangelistConfig[];

  init(data: Partial<JSONConfig>) {
    this.changelists = data.changelists?.length
      ? data.changelists.map((changelist) =>
          new ChangelistConfig().init(changelist)
        )
      : [ChangelistConfig.defaultConfig()];

    return this;
  }

  compare(prev?: JSONConfig | null): boolean {
    if (!prev) {
      return false;
    }

    if (this.changelists.length !== prev.changelists.length) {
      return false;
    }

    return this.changelists.every((changelist, index) =>
      changelist.compare(prev.changelists[index])
    );
  }
}

export class JSONConfigModule {
  private static configPath: string = '.vscode/changelists.json';

  private rootPath: vscode.Uri;

  private config: JSONConfig | null = null;

  constructor(rootPath: vscode.Uri) {
    this.rootPath = rootPath;
  }

  async getConfig(): Promise<JSONConfig | null> {
    return this.config;
  }

  hasConfig(): boolean {
    return !!this.config;
  }

  async initConfig(): Promise<JSONConfig> {
    this.config = await this.loadConfig();

    if (!this.config) {
      this.config = new JSONConfig().init({});
    }

    return this.config;
  }

  setConfig(config: JSONConfig): void {
    this.config = config;
  }

  async loadConfig(): Promise<JSONConfig | null> {
    return JSONConfigModule.loadConfig(this.rootPath);
  }

  async writeConfig(config: JSONConfig): Promise<boolean> {
    return JSONConfigModule.writeConfig(this.rootPath, config);
  }

  async checkIfConfigExists(): Promise<boolean> {
    return JSONConfigModule.checkIfConfigExists(this.rootPath);
  }

  static async loadConfig(rootPath: vscode.Uri): Promise<JSONConfig> {
    if (!rootPath) {
      throw new Error('Root path is not defined');
    }

    const fullPath: vscode.Uri = vscode.Uri.joinPath(rootPath, this.configPath);

    let fileContent: string | undefined = undefined;

    try {
      await vscode.workspace.fs.stat(fullPath);
      const uintArray = await vscode.workspace.fs.readFile(fullPath);
      fileContent = new TextDecoder('utf-8').decode(uintArray);
    } catch (error) {
      console.error('Error reading JSON config file:', error);

      throw error;
    }

    try {
      const parsedContent = JSON.parse(fileContent);
      const newConfig = new JSONConfig();

      return newConfig.init(parsedContent);
    } catch (error) {
      console.error('Error parsing JSON config file:', error);

      throw error;
    }
  }

  static async writeConfig(
    rootPath: vscode.Uri,
    config: JSONConfig
  ): Promise<boolean> {
    if (!rootPath) {
      throw new Error('Root path is not defined');
    }

    try {
      const fullPath = vscode.Uri.joinPath(rootPath, this.configPath);

      const jsonString = JSON.stringify(config, null, 2);
      const uintArray = new TextEncoder().encode(jsonString);
      await vscode.workspace.fs.writeFile(fullPath, uintArray);

      return true;
    } catch (error) {
      logger.appendLine(
        `[Error] Error while writing JSON config file: ${
          (error as Error).message
        }`
      );

      throw error;
    }
  }

  static async checkIfConfigExists(rootPath: vscode.Uri): Promise<boolean> {
    if (rootPath) {
      const fullPath = vscode.Uri.joinPath(rootPath, this.configPath);
      try {
        await vscode.workspace.fs.stat(fullPath);
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  treeToJSONConfig(tree: TreeType, prevConfig?: JSONConfig | null): JSONConfig {
    const changelists = Object.entries(tree).map(([name, items]) => {
      const existingChangelist = prevConfig?.changelists.find(
        (changelist) => changelist.name === name
      );
      const changelist = new ChangelistConfig();
      changelist.init({
        id: existingChangelist?.id || `${getRandomId()}`,
        name,
        files: Object.keys(items)?.length ? Object.keys(items) : [],
      });

      return changelist;
    });

    const config = new JSONConfig().init({ changelists });

    return config;
  }

  jsonConfigToTree(config: JSONConfig): TreeType {
    const tree = new Map<string, TreeType>();

    config.changelists.forEach((item) => {
      tree.set(item.name, {
        ...item.files
          .map((file) => ({ [file]: {} }))
          .reduce((acc, item) => {
            return Object.assign(acc, item);
          }, {}),
      });
    });

    return Object.fromEntries(tree);
  }
}
