import * as vscode from 'vscode';
import fs from 'fs';
import { Util } from './Util';

export interface ITrigger {
	run(...args: any[]): void;
}

export class SwitchFolder implements ITrigger{
	public run(folder:string) {
		vscode.commands.executeCommand('vscode.openFolder', 
			Util.getUri(folder)
		);
	}
}

export class Mkdirs implements ITrigger{
	public run(folder:string) {
		fs.mkdirSync(folder, { recursive: true });
	}
}

export class OpenFile implements ITrigger{
	public run(filepath:string) {
		vscode.commands.executeCommand('vscode.open', 
			Util.getUri(filepath)
		);
	}
}

export class CopyFile implements ITrigger{
	public run(srcFile:string, destFile:string, isOverWrite:boolean=false) {
		if(isOverWrite || !fs.existsSync(destFile)){
			fs.copyFileSync(srcFile, destFile);
		}
	}
}

export class RemoveFile implements ITrigger{
	public run(filepath:string) {
		if (fs.existsSync(filepath)) {
			fs.unlinkSync(filepath);
		}
	}
}

export class CheckFileExist implements ITrigger{
	public run(filepath:string) {
		const _filepath = Util.getFilePath(filepath);
		if (fs.existsSync(_filepath)) {
			throw new Error(`${_filepath} is exist !`);
		} 
	}
}

export class Diff implements ITrigger{
	// public run(...args: any[]) {
	public run(file1: string, file2: string, title: string) {
		const filepath1 = Util.getFilePath(file1);
		const filepath2 = Util.getFilePath(file2);
		if (!fs.existsSync(filepath1)) {
			throw new Error(`file not found ! ${filepath1}`);
		}
		if (!fs.existsSync(filepath2)) {
			throw new Error(`file not found ! ${filepath2}`);
		}
		vscode.commands.executeCommand('vscode.diff', 
			vscode.Uri.file(filepath1),
			vscode.Uri.file(filepath2),
			title
		);
	}
}
