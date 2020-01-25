import * as vscode from 'vscode';
import path from 'path';
import os from 'os';
import { ExtConst } from './ExtConst';

export class Util {
	static getFilePath(filepath: string): string {
		if (path.isAbsolute(filepath)) {
			return path.resolve(filepath);
		}
		else {
			return path.resolve(path.join(Util.workspaceFolder, filepath));
		}
	}
	static getWSLPath(filepath: string): string {
		if(!filepath){ return ""; }
		let _filepath = Util.getFilePath(filepath);
		let sepa: string[] = _filepath.split(path.win32.sep);
		if(sepa.length === 0) {
			return filepath;
		}
		let _subPath = [sepa[0].toLowerCase()].concat(sepa.slice(1));
		let wslPath = "/mnt/" + path.posix.join.apply(path.posix, _subPath).replace(":", "");
		return wslPath;
	}
	static getDockerPath(filepath: string): string {
		if(!filepath){ return ""; }
		let _filepath = Util.getFilePath(filepath);
		let _relate_filepath = path.relative(Util.workspaceFolder, _filepath);
		let sepapath: string[] = Util.isWindows ? _relate_filepath.split(path.win32.sep) : _relate_filepath.split(path.posix.sep);
		let dockerPath = path.posix.join.apply(path.posix, [Util.dockerAppRoot].concat(sepapath));
		return dockerPath;
	}
	static getUri(filepath: string): vscode.Uri {
		return vscode.Uri.file(Util.getFilePath(filepath));
    }
	static replaceAll(target: string, search: string, replacement: string): string {
		return target.replace(new RegExp(search, 'g'), replacement);
    }
    static get homedir(): string {
        return os.homedir();
    }
    static get file(): string {
        return vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : "";
    }
    static get workspaceFolder(): string {
        return vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
    }
    static get workspaceLowercaseName(): string {
        return Util.workspaceFolder ? path.basename(Util.workspaceFolder).toLocaleLowerCase() : "";
    }
    static get selectedText(): string {
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			return "";
		}
		var selection = editor.selection;
		var text = editor.document.getText(selection);
        return text;
    }
    static get configdir(): string {
		return path.join(os.homedir(), `.${ExtConst.extName}`);
    }
    static get backupdir(): string {
		const date = new Date();
		const timeStr = [date.getFullYear(), date.getMonth(), date.getDate(),date.getHours(), date.getMinutes(), date.getSeconds()].join("");
		const backupdir = path.join(Util.configdir, `backup_${timeStr}`);
		return backupdir;
    }
    static get tmpdir(): string {
		return os.tmpdir();
	}
    static get moduledir(): string {
		return __dirname;
	}
    static get lang(): string {
		return vscode.env.language;
	}
    static get isWindows(): boolean {
		return process.platform === 'win32';
	}
    static isSupportPlatform(platforms:Array<string> | undefined , excludePlatforms:Array<string> | undefined ): boolean {
		if(excludePlatforms){ 
			if(excludePlatforms.includes(process.platform)){ return false; }
			if(excludePlatforms.includes("wsl") && Util.isWslMode){ return false; }
			if(excludePlatforms.includes("bash") && Util.isBashMode){ return false; }
			if(excludePlatforms.includes("docker") && Util.isDockerMode){ return false; }
		}
		if(platforms === undefined){ return true;}
		if(platforms.includes(process.platform)){ return true; }
		if(platforms.includes("wsl") && (Util.isWslMode || Util.isDockerMode)){ return true; }
		if(platforms.includes("bash") && (Util.isBashMode || Util.isDockerMode)){ return true; }
		if(platforms.includes("docker") && Util.isDockerMode){ return true; }
		return false;
	}
    private static get _encoding(): string {
		if(process.platform === 'win32'){
			const lang = Util.lang;
			if(lang === "ja"){
				return "CP932";
			} else if(lang === "zh-CN" || lang === "zh-TW"){
				return "CP936";
			}
		}
		return "UTF-8";
	}
    static get encoding(): string {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["encoding"] || ExtConst.encoding || Util._encoding;
	}
    static get dockerAppRoot(): string {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["dockerAppRoot"] || "/app/sfdx";
	}
    static get maxBuffer(): number {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["maxBuffer"] || ExtConst.maxBuffer;
	}
    static get isDebug(): boolean {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["isDebug"] || false;
	}
    static get shellPath(): string | undefined {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		const shellPath = userConfiguration["shellPath"] ? userConfiguration["shellPath"] : undefined;
		return  Util.isWslMode ? shellPath || "C:\\Windows\\System32\\bash.exe" : 
				Util.isDockerMode ? undefined: shellPath ;
	}
    static get optionFeatures(): Array<string> {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration.get("optionFeatures") || [];
	}
    static get isBashMode(): boolean {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["shellMode"] === "bash";
	}
    static get isWslMode(): boolean {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["shellMode"] === "wsl" && Util.isWindows;
	}
    static get isDockerMode(): boolean {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["shellMode"] === "docker";
	}
    static get dockerContainer(): string {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		return userConfiguration["dockerContainer"] || "";
	}
    static getUserConfig(configVars: {  [x: string]: any;} ): {  [x: string]: any;} {
		const userConfiguration = vscode.workspace.getConfiguration(`${ExtConst.extName}`);
		ExtConst.userConfigKeyList.forEach(key =>{
			if(userConfiguration[key]){
				configVars[key] = {
					"label": key,
					"value": userConfiguration[key]
				};
			}
		});
		return configVars;
	}
}
