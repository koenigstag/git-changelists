# Git Changelists

Extension for VSCode adding feature of Changelists GUI. Under the hood it's just few GIT tricks and commands.

## Features

- Create, Rename, Delete changelists
- Add, Remove unstaged files to changelist (via context menu)

Each file that is tracked by git when added to chagelist will be processed through command `git update-index --assume-unchanged filepath`.
Or through `git update-index --no-assume-unchanged filepath` when removed from changelist.

## Known Issues

- There is text inconsistency bug if user does not save each change in appearing text editor.
- Each time changelist is editer - file editor appears and waits user to save changes. This will be remade leter to silent changes.
- This extension may have some parsing issues, and code will be refactored sooner or later.

## Release Notes

## 0.1.1

- Added extension logo and change log file

### 0.1.0

Added working prototype with GUI
