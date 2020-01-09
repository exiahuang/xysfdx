# xysfdx README

[xysfdx](https://github.com/exiahuang/xysfdx) is a Rapid development tool for Salesforce SFDX Development. Metadata diff with server, retrieve standard sobject.

## Features

-   Less than 100k.
-   Support using WSL/git bash/Msys2/MingW64/MingW32 to develop sfdx .
-   Use oauth2.
-   Retrieve Metadata by select.
-   Metadata diff with server(any sfdc organization).
-   Retrieve standard sobject.
-   auto run `.apex` file after save.
-   Quick open sfdc link.
-   Not need to config anything.

## Shortkey

shortkey: `ctrl+shift+j`

## Requirements

[Salesforce Cli](https://developer.salesforce.com/ja/tools/sfdxcli)

## Usage

## Create a project

`force:project:create`

![xycode-sfdx-init-project](https://raw.githubusercontent.com/exiahuang/xycode-doc/gh-pages/images/xycode-sfdx-init-project.gif)

## Diff metadata

`force:source:diff:metadata`

You can diff with any sfdc organization.

### diff source

![xycode-sfdx-diff-meta](https://raw.githubusercontent.com/exiahuang/xycode-doc/gh-pages/images/xycode-sfdx-diff-meta.gif)

### diff profile

![xycode-sfdx-diff-profile-meta](https://raw.githubusercontent.com/exiahuang/xycode-doc/gh-pages/images/xycode-sfdx-diff-profile-meta.gif)

### auto run apex anonymous code

![xycode-sfdx-run-apex-anonymous](https://raw.githubusercontent.com/exiahuang/xycode-doc/gh-pages/images/xycode-sfdx-run-apex-anonymous.gif)

## For wsl/git bash/Msys2 bash user

### use wsl

open `wslmode`

```json
{
    "xysfdx.isWslMode": true,
    "xysfdx.shellPath": "C:\\Windows\\System32\\bash.exe"
}
```

### use msys2

```json
{
    "xysfdx.isWslMode": false,
    "xysfdx.isBashMode": true,
    "xysfdx.shellPath": "C:\\msys64\\usr\\bin\\bash.exe"
}
```

### use git bash

```json
{
    "xysfdx.isWslMode": false,
    "xysfdx.isBashMode": true,
    "xysfdx.shellPath": "C:\\Program Files\\Git\\git-bash.exe"
}
```

**Enjoy it!**
