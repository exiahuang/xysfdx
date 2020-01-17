import * as child_process from "child_process";
import { Util } from "./Util";

export interface CommandRunnerOptions {
	maxBuffer: number;
	encoding: string;
	isWslMode: boolean;
	shellPath: string | undefined;
	cwd?: string;
}

export class BaseCommandRunner {
	public async exec(command: string, options: child_process.ExecOptions): Promise<{
		stdout: string;
		stderr: string;
	}> {
		return new Promise<{
			stdout: string;
			stderr: string;
		}>((resolve, reject) => {
			child_process.exec(command, options, (error, stdout, stderr) => {
				if (stdout) {
					stdout = stdout.toString();
				}
				if (stderr) {
					stderr = stdout.toString();
				}
				if (error) {
					console.log(command);
					console.log(options);
					console.error(error);
					let _errorExceptionMsg = error.toString();
					let errorMsg = [_errorExceptionMsg, stdout, stderr].join("\r\n");
					reject(errorMsg);
				}
				resolve({ stdout, stderr });
			});
		});
	}
}

export class SimpleCommandRunner {
	constructor(private readonly options: CommandRunnerOptions) {
	}
	public async exec(command: string): Promise<{
		stdout: string;
		stderr: string;
	}> {
		return new Promise<{
			stdout: string;
			stderr: string;
		}>((resolve, reject) => {
			let options: child_process.ExecOptions = {
				maxBuffer: this.options.maxBuffer,
				shell: this.options.shellPath,
				cwd: this.options.cwd || Util.homedir
			};
			child_process.exec(command, options, (error, stdout, stderr) => {
				if (stdout) {
					stdout = stdout.toString();
				}
				if (stderr) {
					stderr = stdout.toString();
				}
				if (error) {
					console.log(command);
					console.log(options);
					console.error(error);
					let _errorExceptionMsg = error.toString();
					let errorMsg = [_errorExceptionMsg, stdout, stderr].join("\r\n");
					reject(errorMsg);
				}
				resolve({ stdout, stderr });
			});
		});
	}
}
