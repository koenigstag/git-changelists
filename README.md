# Git Changelists

Extension for VSCode adding feature of Changelists GUI. Under the hood it's just few GIT tricks and commands.

### Features

- Create, Rename, Delete changelists
- Add, Remove unstaged files to changelist (via context menu)

Each file that is tracked by git when added to chagelist will be processed through command `git update-index --assume-unchanged filepath`.
Or through `git update-index --no-assume-unchanged filepath` when removed from changelist.

### Known Issues

- This extension may have some parsing issues, and code will be refactored sooner or later.

### Release Notes

#### 0.1.6

- Fix check if git repo exist
- Add files counter to changelist
- Add file open on click

#### 0.1.5

- Refactor error handling

#### 0.1.4

- Refactor code: split to files, refactor logic, add error messages

#### 0.1.3

- Add license txt file

#### 0.1.2

- Add silent save

#### 0.1.1

- Added extension logo and change log file

#### 0.1.0

Added working prototype with GUI
