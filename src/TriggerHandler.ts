import * as triggerhandlers from './Trigger';

export function getTriggerHandler(className: string, ...args: any[]) {
	return new (<any>triggerhandlers)[className](...args);
}
