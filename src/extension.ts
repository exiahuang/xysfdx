import * as vscode from 'vscode';
import path from 'path';
import * as child_process from "child_process";
import { XycodeUI } from './XycodeUI';
import { getTriggerHandler } from './TriggerHandler';
import { Util } from './Util.js';
import { TaskType, Config } from './Config';
import { ConfigManager, ConfigDesc } from './ConfigManager';
import { ExtConst } from './ExtConst';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const xycodeui = XycodeUI.instance;
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// The command has been defined in the package.json file

	context.subscriptions.push(vscode.commands.registerCommand(`${ExtConst.extName}.open`, async () => {
		const config = Config.data;
		if(config.tasks.length === 0){
			vscode.commands.executeCommand(`${ExtConst.extName}.config`);
			return;
		}
		const task = await vscode.window.showQuickPick(config.tasks.filter(task => !task.inActive));
		if (!task) { return false; }
		const configVars = Util.getUserConfig(config.variables);
		if(task.notShowProcess){
			new CommandRunner(Util.maxBuffer, task.encoding || Util.encoding).run(task, configVars, Util.file, Util.workspaceFolder);
		} else {
			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: `${ExtConst.extName} running ${task.label}`
				},
				async progress => {
					  // Progress is shown while this function runs.
					  // It can also return a promise which is then awaited
					await new CommandRunner(Util.maxBuffer, task.encoding || Util.encoding).run(task, configVars, Util.file, Util.workspaceFolder);
				}
			);
		}
	}));

	if(ExtConst.isRegistConfigCommand){
		context.subscriptions.push(vscode.commands.registerCommand(`${ExtConst.extName}.config`, async () => {
		try {
			const cm = new ConfigManager();
			const configList = await cm.getConfigList();
			if(configList === undefined){
					xycodeui.showErrorMessage(`${ExtConst.extName} get config error`);
				return;
			}
			const selectList: Array<ConfigDesc> | undefined = await vscode.window.showQuickPick(configList, {
				canPickMany: true,
					placeHolder: "Please Download Config For ${ExtConst.extName}"
			});
			if(selectList){
				selectList.forEach(async (desc) => {
					try {
						await cm.download(desc);
						xycodeui.channelShow(`${desc.name} download ok!`);
					} catch (error) {
							xycodeui.showErrorMessage(`${ExtConst.extName} download config exception ${error}`);
					}
				});
					xycodeui.showInformationMessage(`${ExtConst.extName} Config Download done! Enjoy yourself!`);
			}
		} catch (error) {
				xycodeui.showErrorMessage(`${ExtConst.extName} ${error}`);
		}
	}));
	}

	vscode.workspace.onDidSaveTextDocument(async (doc) =>{
		const config = Config.data;
		const fileType = path.extname(doc.fileName);
		const tasks = config.onSaveEvents?.filter(task =>{
			return !task.inActive && (!task.filetypes || fileType && task.filetypes.includes(fileType));
		});
		const maxBuffer = Util.maxBuffer;
		const encoding =  Util.encoding;
		await tasks?.forEach(async (task) => {
			await new CommandRunner(maxBuffer, task.encoding || encoding).run(task, Util.getUserConfig(config.variables), doc.fileName, Util.workspaceFolder);
		});
	});

	if(ExtConst.isShowMessage){
		xycodeui.channelShow(ExtConst.message);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}


class CommandRunner {
	private commandBuilder = new CommandBuilder();
	private file: string = "";
	private workspaceFolder: string = "";

	constructor(public readonly maxBuffer: number, public readonly encoding: string){
	}

	public async exec(command: string, options: child_process.ExecOptions) : Promise<{ stdout: string; stderr: string }> {
		return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
			child_process.exec(command, options, (error, stdout, stderr) => {
				if(stdout){
					stdout = stdout.toString();
				}
				if(stderr){
					stderr = stdout.toString();
				}
				if (error) {
					let _errorExceptionMsg = error.toString();
					let errorMsg = [_errorExceptionMsg, stdout, stderr].join("\r\n");
					reject(errorMsg);
				}
				resolve({ stdout, stderr });
			});
		});
	}

	public async run(task: TaskType, configVars: { [x: string]: any; }, file?: string, workspaceFolder?: string) {
		const xycodeui = XycodeUI.instance;
		this.file = file || "";
		this.workspaceFolder = workspaceFolder || Util.homedir;
		try {
			const filetype = path.extname(this.file);
			if(!(!task.filetypes || task.filetypes && filetype && task.filetypes.includes(filetype))){
				return;
			}
			if(task.inActive) {
				return;
			}
			xycodeui.channelShow(task.label);

			let command = await this.commandBuilder.parser(task, configVars, this.file, this.workspaceFolder);
			let cwd = task.cwd ? this.commandBuilder.format(task.cwd) : this.workspaceFolder;
			if(!cwd){
				xycodeui.showErrorMessage("workspace folder is null!");
				return;
			}

			xycodeui.openChannel();
			xycodeui.channelShow(command);
			
			if(task.beforeTriggers){
				await this.invokeTrigger(task.beforeTriggers, cwd);
			}
			
			if(task.termial){
				xycodeui.getTerminal(this.commandBuilder.format(task.termial.name), task.termial.shellPath, task.termial.shellArgs).sendText(command);
			} else{
				let { stdout, stderr } = await this.exec(command, { cwd: cwd, maxBuffer: this.maxBuffer });

				if (stderr && stderr.length > 0) {
					xycodeui.showErrorMessage(stderr);
					xycodeui.channelShow(stderr);
				}
				if (stdout && stdout.length > 0) {
					xycodeui.channelShow(stdout);
				}
				if(!(stderr && stderr.length > 0) && task.afterTriggers){
					await this.invokeTrigger(task.afterTriggers, cwd);
				}
			}

			xycodeui.channelShow("", false);
		}
		catch(e) {
			xycodeui.showErrorMessage(`${ExtConst.extName} ${e}`);
			xycodeui.channelShow(e);
		}
	}

	private async invokeTrigger(triggers: Array<{type: string, fn: string, params: []}>, cwd : string) {
		for(let trigger of triggers) {
			let _params = trigger["params"].map(param =>{
				if(typeof param === "string"){
					return this.commandBuilder.format(param);
				}
				return param;
			} );
			if(!trigger.hasOwnProperty("type") || trigger["type"] === "buildin"){
				getTriggerHandler(trigger["fn"]).run(..._params);
			} else if(trigger["type"] === "shell"){
				// let { stdout, stderr } = await this.exec(trigger["fn"], { cwd: cwd, maxBuffer: this.maxBuffer });
				// await this.exec(trigger["fn"]);
				// todo
			}
		}
	}
}

class CommandBuilder{
	public customVars: { [index: string]: string; } = {};
	private configVars: any;
	private fileAttr: any;

	public async parser(task: any, configVars: any, file: string, workspaceFolder: string) : Promise<string> {
		const xycodeui = XycodeUI.instance;
		this.configVars = { 
							...configVars, 
							"SFDX_ALIAS": new DefaultEnv().getSfdxAlias()
						};
		this.fileAttr = this.getFileAttr(file, workspaceFolder);

		let command = task["command"];
		let output = command;
		const regex = new RegExp(/\${(input|select|multiselect|openFolderDailog|singleFileDailog|multiFilesDailog)(\s)*:(\s)*([^} ]+)(\s)*}/g);
		let matches;
		while ((matches = regex.exec(command)) !== null) {
			const varkey = matches[4];
			const commandType = matches[1];
			if(this.customVars.hasOwnProperty(varkey)){
				output = output.replace(matches[0], this.customVars[varkey]);
				continue;
			}
			const configVar = this.configVars[varkey];
			let customInput;
			if(commandType === "select"){
				if(!this.configVars.hasOwnProperty(varkey)){
					throw new Error(`Select Config ${varkey} Error!`);
				}
				customInput = await xycodeui.showQuickPick(varkey, configVar);
			} else if(commandType === "multiselect"){
				if(!this.configVars.hasOwnProperty(varkey)){
					throw new Error(`Select Config ${varkey} Error!`);
				}
				customInput = await xycodeui.showQuickMultiPick(varkey, configVar);
			} else if(commandType === "input"){
				customInput = await xycodeui.showInputBox(varkey, configVar);
			} else if(commandType === "openFolderDailog"){
				customInput = await xycodeui.openFolderDialog(configVar);
			} else if(commandType === "singleFileDailog"){
				customInput = await xycodeui.openFileDialog(configVar);
			} else if(commandType === "multiFilesDailog"){
				customInput = await xycodeui.openFilesDialog(configVar);
			}
			
			if(customInput){
				output = output.replace(matches[0], customInput);
				this.customVars[varkey] = customInput;
			} else {
				throw new Error(`${task["command"]} \r\n ${varkey} : ${customInput} is null!`);
			}
		}
		return this.format(output);
	}

	public format(variable: string | undefined): string {
		if(!variable) { return ""; }
		let result = variable;
		for(let key in this.customVars) {
			result = Util.replaceAll(result, "\\${" + key + "}", this.customVars[key]);
		}
		for(let key in this.configVars) {
			let val = this.configVars[key]["value"];
			if(typeof val === "string" || typeof val === "number"){
				result = Util.replaceAll(result, "\\${" + key + "}", val.toString());
			}
		}
		return this.replaceFileAttr(result);
	}

	private replaceFileAttr(command:string): string {
		for(let key in this.fileAttr) {
			command = Util.replaceAll(command, "\\${" + key + "}", this.fileAttr[key]); 
		}
		return command;
	}

	private getFileAttr(file: string, workspaceFolder:string): { [index: string]: string; } {
        const date = new Date();
        const YYYYMMDD = [date.getFullYear(), date.getMonth(), date.getDate()].join("");
        const HHmm = [date.getHours(), date.getMinutes()].join("");
        return {
            "HOME" : Util.homedir,
            "TMPDIR" : Util.tmpdir,
            "XYCODE_PATH" : Util.moduledir,
            "file" : file,
            "fileBasename": path.basename(file),
			"fileBasenameNoExtension":  path.basename(file, path.extname(file)),
			"relativeFile" : path.relative(workspaceFolder, file),
			"relativeFileDirname" : path.relative(workspaceFolder, path.dirname(file)),
            "workspaceFolder" : workspaceFolder,
            "workspaceFolderBasename" : path.basename(workspaceFolder),
            "fileDirname" : path.dirname(file),
			"fileExtname" : path.extname(file),
			"selectedText" : Util.selectedText,
            "YYYYMMDD": YYYYMMDD,
            "YYYYMMDD_HHmm": [YYYYMMDD, "_", HHmm].join("")
        };
    }
}


class DefaultEnv
{
	public getSfdxAlias() : { [index: string]: any; } {
		return {
				"label" : "Sfdx Alias",
				"value" : this.getSfdxAliasList()
		};
	}

	private getSfdxAliasDict() : { [index: string]: string; }  {
		try{
			const data = require(path.join(this.getUserRootFolder(), '.sfdx', 'alias.json'));
			return data["orgs"];
		}catch(e){
		}
		return {};
	}

	private getSfdxAliasList() {
		return Object.keys(this.getSfdxAliasDict());
	}

	private getUserRootFolder() : string {
		const root = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
		return root || "";
	}
}