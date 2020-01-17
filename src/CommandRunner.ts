import path from 'path';
import * as child_process from "child_process";
import { XycodeUI } from './XycodeUI';
import { getTriggerHandler } from './TriggerHandler';
import { Util } from './Util.js';
import { TaskType, TaskUtil } from './Config';
import { ExtConst } from './ExtConst';
import { BaseCommandRunner, CommandRunnerOptions } from './BaseCommandRunner';
import { SimpleQuickPickItem } from './SimpleQuickPickItem';

export class CommandRunner extends BaseCommandRunner {
	private commandBuilder: CommandBuilder;
	private file: string = "";
	private workspaceFolder: string = "";
	constructor(private readonly options: CommandRunnerOptions) {
		super();
		this.commandBuilder = new CommandBuilder(options);
	}
	public async run(task: TaskType, configVars: {
		[x: string]: any;
	}, file?: string, workspaceFolder?: string) {
		const xycodeui = XycodeUI.instance;
		this.file = file || "";
		this.workspaceFolder = workspaceFolder || Util.homedir;
		try {
			const filetype = path.extname(this.file);
			if(!TaskUtil.isTaskActive(task, filetype)){
				return;
			}
			xycodeui.channelShow(task.label);
			let command = await this.commandBuilder.parser(task, configVars, this.file, this.workspaceFolder);
			let cwd = task.cwd ? this.commandBuilder.format(task.cwd) : this.workspaceFolder;
			cwd = path.resolve(cwd);
			if (!cwd) {
				xycodeui.showErrorMessage("workspace folder is null!");
				return;
			}
			xycodeui.openChannel();
			xycodeui.channelShow(command);
			xycodeui.debug(cwd);
			xycodeui.debug(JSON.stringify(task));
			if (task.beforeTriggers) {
				await this.invokeTrigger(task.beforeTriggers, cwd);
			}
			if (task.termial) {
				const shellPath = task.termial.shellPath || this.options.shellPath;
				xycodeui.getTerminal(this.commandBuilder.format(task.termial.name), shellPath, task.termial.shellArgs).sendText(command);
			}
			else {
				let options: child_process.ExecOptions = {
					cwd: cwd,
					maxBuffer: this.options.maxBuffer,
					shell: this.options.shellPath
				};
				if(task.options){
					options = { ...options, ...task.options };
				}
				let { stdout, stderr } = await this.exec(command, options);
				if (stderr && stderr.length > 0) {
					xycodeui.showErrorMessage(stderr);
					xycodeui.channelShow(stderr);
				}
				if (stdout && stdout.length > 0) {
					xycodeui.channelShow(stdout);
				}
				if (!(stderr && stderr.length > 0) && task.afterTriggers) {
					await this.invokeTrigger(task.afterTriggers, cwd);
				}
			}
			xycodeui.channelShow("", false);
		}
		catch (e) {
			xycodeui.showErrorMessage(`${ExtConst.extName} ${e}`);
			xycodeui.channelShow(e);
		}
	}
	private async invokeTrigger(triggers: Array<{
		type: string;
		fn: string;
		params: [];
	}>, cwd: string) {
		for (let trigger of triggers) {
			let _params = trigger["params"].map(param => {
				if (typeof param === "string") {
					return this.commandBuilder.format(param);
				}
				return param;
			});
			if (!trigger.hasOwnProperty("type") || trigger["type"] === "buildin") {
				getTriggerHandler(trigger["fn"]).run(..._params);
			}
			else if (trigger["type"] === "shell") {
				// let { stdout, stderr } = await this.exec(trigger["fn"], { cwd: cwd, maxBuffer: this.maxBuffer });
				// await this.exec(trigger["fn"]);
				// todo
			}
		}
	}
}

export class CommandBuilder{
	public customVars: { [index: string]: string; } = {};
	private configVars: any;
	private fileAttr: any;

	constructor(private readonly options : CommandRunnerOptions){
	}

	public async parser(task: TaskType, configVars: any, file: string, workspaceFolder: string) : Promise<string> {
		const xycodeui = XycodeUI.instance;
		this.configVars = { 
							...configVars, 
							"SFDX_ALIAS": await new DefaultEnv(this.options).getSfdxAlias()
						};
		this.fileAttr = this.getFileAttr(file, workspaceFolder);

		let command = task.command;
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
			let customInputWsl;
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
				customInputWsl = customInput ? Util.getWSLPath(customInput) : undefined;
			} else if(commandType === "singleFileDailog"){
				customInput = await xycodeui.openFileDialog(configVar);
				customInputWsl = customInput ? Util.getWSLPath(customInput) : undefined;
			} else if(commandType === "multiFilesDailog"){
				customInput = await xycodeui.openFilesDialog(configVar, this.options.isWslMode);
				customInputWsl = customInput;
			}
			
			if(customInput){
				if(this.options.isWslMode && Util.isWindows && customInputWsl){
					if(task.winNativePath){
						output = Util.replaceAll(output, "\\" + matches[0], customInput);
					} else {
						output = Util.replaceAll(output, "\\" + matches[0], customInputWsl);
					}
					this.customVars["WSL__" + varkey] = customInputWsl;
				} else {
					output = Util.replaceAll(output, "\\" + matches[0], customInput);
				}
				this.customVars[varkey] = customInput;
			} else {
				throw new Error(`${task.command} \r\n ${varkey} : ${customInput} is null!`);
			}
		}
		if(this.options.isWslMode && Util.isWindows && !task.winNativePath){
			output = this.replaceWslFileAttr(output, this.fileAttr);
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

	private replaceWslFileAttr(command:string, fileAttr: { [index: string]: string; }): string {
		for(let key of ["HOME", "TMPDIR", "file", "fileDirname", "workspaceFolder"]) {
			if(fileAttr.hasOwnProperty(key)){
				command = Util.replaceAll(command, "\\${" + key + "}", Util.getWSLPath(fileAttr[key])); 
			}
		}
		return command;
	}

	private getFileAttr(file: string, workspaceFolder:string): { [index: string]: string; } {
        const date = new Date();
        const YYYYMMDD = [date.getFullYear(), date.getMonth(), date.getDate()].join("");
        const HHmm = [date.getHours(), date.getMinutes()].join("");
        let fileAttr = {
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
		return fileAttr;
    }
}

class DefaultEnv
{
	constructor(private readonly options : CommandRunnerOptions){
	}

	public async getSfdxAlias() : Promise<{[index: string]: any;}> {
		return {
				"label" : "Sfdx Alias",
				"value" : this.options.isWslMode && Util.isWindows ? await this.getWslSfdxAlias() : this._getSfdxAlias()
		};
	}

	private _getSfdxAlias() : Array<SimpleQuickPickItem>  {
		try{
			const data = require(path.join(this.getUserRootFolder(), '.sfdx', 'alias.json'));
			return this.getSfdxAliasQuickPickItems(data["orgs"]);
		}catch(e){
		}
		return [];
	}

	private getUserRootFolder() : string {
		const root = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
		return root || "";
	}
	
	private async getWslSfdxAlias() : Promise<Array<SimpleQuickPickItem>>  {
		return new Promise<Array<SimpleQuickPickItem>>(async (resolve, reject) => {
			try{
				const command = 'cat ~/.sfdx/alias.json';
				let options :child_process.ExecOptions = { 
					maxBuffer: this.options.maxBuffer, 
					shell:  this.options.shellPath
				};
				const { stdout, stderr } = await new BaseCommandRunner().exec(command, options);
				const orgs = JSON.parse(stdout)['orgs'];
				resolve(this.getSfdxAliasQuickPickItems(orgs));
			}catch(e){
				resolve([]);
			}
		});
	}

	private getSfdxAliasQuickPickItems(orgs: any) {
		let wslSfdxAlias: Array<SimpleQuickPickItem> = [];
		for (let key in orgs) {
			wslSfdxAlias.push(new SimpleQuickPickItem({
				label: key,
				description: orgs[key].toString()
			}));
		}
		return wslSfdxAlias;
	}
}