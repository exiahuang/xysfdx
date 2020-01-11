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
		let _filepath = Util.getFilePath(filepath);
		let sepa: string[] = _filepath.split(path.win32.sep);
		if(sepa.length === 0) {
			return filepath;
		}
		let _subPath = [sepa[0].toLowerCase()].concat(sepa.slice(1));
		let wslPath = "/mnt/" + path.posix.join.apply(path.posix, _subPath).replace(":", "");
		return wslPath;
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
    static isSupportPlatform(platforms:Array<string> | undefined ): boolean {
		if(platforms === undefined){ return true;}
		if(platforms.includes(process.platform)){ return true; }
		if(platforms.includes("wsl") && Util.isWslMode){ return true; }
		if(platforms.includes("bash") && Util.isBashMode){ return true; }
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
		return Util.isWslMode ? shellPath || "C:\\Windows\\System32\\bash.exe" : shellPath ;
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
