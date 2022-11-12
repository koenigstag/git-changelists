export const newLineRegex = /\r?\n/;

export const pathDelim = /[/\\]/g;

export const changelistNameRegex = /([\w ]+)/;

export const changelistStartRegex = RegExp(
  `^# ==== ${changelistNameRegex.source} ====$`
);

export const workzoneStartRegex = /^# ==== GIT CHANGELISTS ====$/;

export const workzoneEndRegex = /^# ==== END: GIT CHANGELISTS ====$/;

export const removeSpecialSymbs = (str: string) => {
  return str.replace(/[\^\$\?\+\*]/g, '');
};
