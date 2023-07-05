export const EXTENSION_ID = 'git-changelists';

export const extComands = {
  extName: EXTENSION_ID,
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
