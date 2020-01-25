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
			xycodeui.info(task.label);
			let command = await this.commandBuilder.parser(task, configVars, this.file, this.workspaceFolder);
			let cwd = task.cwd ? this.commandBuilder.format(task.cwd) : this.workspaceFolder;
			cwd = path.resolve(cwd);
			if (!cwd) {
				xycodeui.showErrorMessage("workspace folder is null!");
				return;
			}
			xycodeui.openChannel();
			xycodeui.info("cwd : " + cwd);
			xycodeui.debug(task, true);
			if (task.beforeTriggers) {
				await this.invokeTrigger(task.beforeTriggers, cwd);
			}

			xycodeui.debug(Util.isDockerMode ? "docker mode" : Util.isWslMode ? "wsl mode": Util.isBashMode ? "bash mode" : "");

			if (task.termial) {
				let options :any = { 
					name : this.commandBuilder.format(task.termial.name), 
					shellPath : task.termial.shellPath || this.options.shellPath,
					shellArgs : task.termial.shellArgs
				};
				xycodeui.debug(options, true);
				xycodeui.getTerminal(options).sendText(command);
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
				if(Util.isWslMode){
					options.shell = undefined;
				}
				xycodeui.debug(options, true);
				let { stdout, stderr } = await this.exec(command, options);
				// It seems some error not show...
				if (stderr && stderr.length > 0 && stdout !== stderr) {
					// xycodeui.showErrorMessage(stderr);
					xycodeui.warn(stderr);
				}
				if (stdout && stdout.length > 0) {
					xycodeui.channelShow(stdout);
				}
				if (!(stderr && stderr.length > 0 && stdout !== stderr) && task.afterTriggers) {
					await this.invokeTrigger(task.afterTriggers, cwd);
				}
			}
			xycodeui.channelShow("", false);
		}
		catch (e) {
			xycodeui.showErrorMessage(`${ExtConst.extName} ${e}`);
			xycodeui.fatal(e);
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

	constructor(private options : CommandRunnerOptions){
	}

	public async parser(task: TaskType, configVars: any, file: string, workspaceFolder: string) : Promise<string> {
		XycodeUI.instance.debug("start to parser command");
		const xycodeui = XycodeUI.instance;
		this.init(file, workspaceFolder);
		const defaultEnv = await new DefaultEnv(this.options).load(task.command);
		if(defaultEnv){
			xycodeui.debug(defaultEnv, true);
			this.configVars = { ...configVars, ...defaultEnv };
		}

		let command = task.command;
		let output = command;
		const regex = new RegExp(/\${(input|select|multiselect|openFolderDailog|singleFileDailog|multiFilesDailog)(\s)*:(\s)*([^} \|]+)(\s)*(\|wslpath)?}/g);
		let matches;
		while ((matches = regex.exec(command)) !== null) {
			const varkey = matches[4];
			const commandType = matches[1];
			if(this.customVars.hasOwnProperty(varkey)){
				output = output.replace(matches[0], this.customVars[varkey]);
				continue;
			}
			const configVar = this.configVars[varkey];
			const isDockerMode = Util.isDockerMode;
			let customInput;
			let customInputWsl;
			let customInputDocker;
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
				customInputDocker = isDockerMode && customInput ? Util.getDockerPath(customInput) : undefined;
			} else if(commandType === "singleFileDailog"){
				customInput = await xycodeui.openFileDialog(configVar);
				customInputWsl = customInput ? Util.getWSLPath(customInput) : undefined;
				customInputDocker = isDockerMode && customInput ? Util.getDockerPath(customInput) : undefined;
			} else if(commandType === "multiFilesDailog"){
				let _openfiles = await xycodeui.openFilesDialog(configVar);
				let separator = configVar && configVar.hasOwnProperty("separator") ? configVar["separator"] : " ";
				customInput = _openfiles.join(separator);
				customInputWsl = _openfiles.map(path => "\"" + Util.getWSLPath(path) + "\"").join(separator);
				customInputDocker = isDockerMode ? _openfiles.map(path => "\"" + Util.getDockerPath(path) + "\"").join(separator) : undefined;
			}
			
			if(customInput){
				if(this.options.isWslMode && Util.isWindows && customInputWsl){
					if(task.isNativeCommand){
						output = Util.replaceAll(output, "\\" + matches[0], customInput);
					} else {
						XycodeUI.instance.debug("wsl path: " + customInputWsl);
						output = Util.replaceAll(output, "\\" + matches[0], customInputWsl);
					}
					this.customVars["WSL__" + varkey] = customInputWsl;
				} else if(matches[6] === '|wslpath'){
					output = Util.replaceAll(output, "\\" + matches[0].replace('|wslpath', '\\|wslpath'), customInputWsl ? customInputWsl : Util.getWSLPath(customInput));
				} else if(Util.isDockerMode && customInputDocker){
					if(task.isNativeCommand){
						output = Util.replaceAll(output, "\\" + matches[0], customInput);
					} else {
						XycodeUI.instance.debug("docker path: " + customInputDocker);
						output = Util.replaceAll(output, "\\" + matches[0], customInputDocker);
					}
				} else {
					output = Util.replaceAll(output, "\\" + matches[0], customInput);
				}
				this.customVars[varkey] = customInput;
			} else {
				throw new Error(`${task.command} \n ${varkey} : ${customInput} is null!`);
			}
		}
		if(!task.isNativeCommand){
			if(this.options.isWslMode && Util.isWindows){
				output = this.replacePosixFileAttr(output, this.fileAttr, "wsl");
			}
			if(Util.isDockerMode){
				output = this.replacePosixFileAttr(output, this.fileAttr, "docker");
			}
		}
		command = this.format(output);
		command = this.formatAsPlatformCommand(task, command);
		return command;
	}

	private init(file: string, workspaceFolder:string) {
		this.fileAttr = this.getFileAttr(file, workspaceFolder);
		this.options.dockerContainer = this.replaceFileAttr(Util.dockerContainer);
	}

	public formatAsPlatformCommand(task: TaskType, command: string): string{
		XycodeUI.instance.info(command);
		if(task.isNativeCommand) {
			return command;
		}
		if(Util.isDockerMode){
			if(!this.options.dockerContainer){
				throw new Error(`can not find docker container!`);
			}
			command = task.dockerOptions?.cwd ? `cd "${task.dockerOptions?.cwd}" && ${command}` : command;
			command = Util.replaceAll(command, "\"", "\\\"");
			if(task.dockerOptions?.openTTY){
				command = `docker exec -it ${this.options.dockerContainer} /bin/sh -c "${command}"`;
			} else {
				command = `docker exec ${this.options.dockerContainer} /bin/sh -c "${command}"`;
			}
			XycodeUI.instance.info(command);
		}
		if(Util.isWslMode && Util.isWindows && !task.termial){
			// TODO
			// task.termial.shellPath || this.options.shellPath
			command = `"${this.options.shellPath}" -c "${Util.replaceAll(command, "\"", "\\\"")}"`;
			XycodeUI.instance.info(command);
		}
		return command;
	}

	public format(variable: string | undefined): string {
		XycodeUI.instance.debug("start to format command");
		if(!variable) { return ""; }
		let result = variable;
		for(let key in this.customVars) {
			if(!result.includes(key)) {
				continue;
			}
			result = Util.replaceAll(result, "\\${" + key + "}", this.customVars[key]);
			if(result.includes("|wslpath")) {
				result = Util.replaceAll(result, "\\${" + key + "\\|wslpath}", this.customVars[key] ? Util.getWSLPath(this.customVars[key]) : "");
			}
		}
		for(let key in this.configVars) {
			if(!result.includes(key)) {
				continue;
			}
			let val = this.configVars[key]["value"];
			if(typeof val === "string" || typeof val === "number"){
				result = Util.replaceAll(result, "\\${" + key + "}", val.toString());
				if(result.includes("|wslpath")) {
					result = Util.replaceAll(result, "\\${" + key + "\\|wslpath}", val.toString() ? Util.getWSLPath(val.toString()) : "");
				}
			}
		}
		return this.replaceFileAttr(result);
	}

	private replaceFileAttr(command:string): string {
		XycodeUI.instance.debug("start to replaceFileAttr");
		if(!command) {
			return "";
		}
		for(let key in this.fileAttr) {
			if(!command.includes(key)) {
				continue;
			}
			command = Util.replaceAll(command, "\\${" + key + "}", this.fileAttr[key]); 
			if(command.includes("|wslpath")) {
				command = Util.replaceAll(command, "\\${" + key + "\\|wslpath}", this.fileAttr[key] ? Util.getWSLPath(this.fileAttr[key]) : "");
			}
		}
		return command;
	}

	private replacePosixFileAttr(command:string,fileAttr: { [index: string]: string; }, type: string): string {
		for(let key of ["HOME", "TMPDIR", "file", "fileDirname", "workspaceFolder"]) {
			if(fileAttr.hasOwnProperty(key)){
				command = Util.replaceAll(command, "\\${" + key + "}", type === "wsl" ? Util.getWSLPath(fileAttr[key]) : type === "docker" ? Util.getDockerPath(fileAttr[key]) : fileAttr[key] ); 
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
            "lowercaseWorkspaceName" : Util.workspaceLowercaseName,
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

	public async load(command:string) : Promise<{[index: string]: any;}>{
		return new Promise<{[index: string]: any;}>(async (resolve, reject) => {
			resolve({
				"SFDX_ALIAS": command.includes("SFDX_ALIAS") ? await this.getSfdxAlias(this.options.isWslMode && Util.isWindows || Util.isDockerMode) : []
			});
		});
	}

	private async getSfdxAlias(isWsl:boolean) : Promise<{[index: string]: any;}> {
		return {
				"label" : "Sfdx Alias",
				"value" : isWsl ? await this.getWslSfdxAlias() : this._getSfdxAlias()
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
				let command = 'cat ~/.sfdx/alias.json';
				let options :child_process.ExecOptions = { 
					maxBuffer: this.options.maxBuffer, 
					shell:  this.options.shellPath
				};
				if(Util.isDockerMode){
					options.cwd = Util.workspaceFolder;
					command = `docker exec ${this.options.dockerContainer} /bin/sh -c "${command}"`;
				}
				const { stdout, stderr } = await new BaseCommandRunner().exec(command, options);
				if(stderr) {
					XycodeUI.instance.debug(stderr);
				}
				if(stdout) {
					XycodeUI.instance.debug("load alias.json done!");
					XycodeUI.instance.debug(stdout);
				}
				const orgs = JSON.parse(stdout)['orgs'];
				resolve(this.getSfdxAliasQuickPickItems(orgs));
			} catch(e){
				XycodeUI.instance.warn("get SfdxAlias exception : " + e);
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