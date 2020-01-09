import * as vscode from 'vscode';

export class SimpleQuickPickItem implements vscode.QuickPickItem {
	label: string = '';
	description?: string | undefined;
	detail?: string | undefined;
	picked?: boolean | undefined;
	alwaysShow?: boolean | undefined;
	constructor(props: vscode.QuickPickItem) {
		Object.assign(this, props);
	}
	public toString = (): string => {
		return this.label;
	}
}
