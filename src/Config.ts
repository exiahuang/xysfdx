import fs from 'fs';
import path from 'path';
import { XycodeUI } from './XycodeUI';
import { Util } from './Util';
import { ExtConst } from './ExtConst';

export interface TaskType {
    optFeatureLabel?: string;
    label: string;
    description: string;
    command: string;
    options?: any;
    // winNativePath is only use for wsl
    isDebug?: boolean;
    winNativePath?: boolean;
    platforms?: Array<string>;
    filetypes?: Array<string>;
    encoding?: string;
    cwd?: string;
    inActive?: boolean;
    termial?: { name?: string, shellPath?: string, shellArgs?: string[] | string };
    notShowProcess?: boolean;
    beforeTriggers?: Array<{type: string, fn: string, params: []}>;
    afterTriggers?: Array<{type: string, fn: string, params: []}>;
}

export interface ConfigType {
    tasks: Array<TaskType>;
    variables: { [x: string]: any; };
    onSaveEvents?: Array<TaskType>;
}

export class Config{
    private static defaultConfig:ConfigType;
    private static _data:ConfigType;

    private constructor() {
    }
    
    private static _merge(config1:ConfigType , config2: ConfigType): ConfigType{
        let config: ConfigType = {tasks:[], variables:{}, onSaveEvents:[] };
        config.tasks = config1.tasks.concat(config2.tasks);
        config.variables = { ...config1.variables, ...config2.variables };
        config.onSaveEvents = (config1.onSaveEvents || []).concat(config2.onSaveEvents || []);
        return config;
    }

    private static _loadConfig(configdir: string): ConfigType{
        let config: ConfigType = {tasks:[], variables:{}, onSaveEvents:[] };
        if(fs.existsSync(configdir)){
            fs.readdirSync(configdir).forEach(file => {
                if(path.extname(file) !== ".json"){
                    return;
                }
                try {
                    const config2: ConfigType = JSON.parse(fs.readFileSync(path.join(configdir, file), 'utf8'));
                    config = Config._merge(config, config2);
                } catch (error) {
                    XycodeUI.instance.showErrorMessage(`${file}: ${error}`);
                }
            });
        }
        return config;
    }

    public static get data(): ConfigType {
        if (!Config.defaultConfig) {
            Config.defaultConfig = Config._loadConfig(path.join(__dirname, './conf'));
        }
        if(ExtConst.isLoadHomeConfig){
            let customConfigData = Config._loadConfig(Util.configdir);
            Config._data = Config._merge(Config.defaultConfig, customConfigData);
            return Config._data;
        } else{
            return Config.defaultConfig;
        }
    }
}

export class TaskUtil {
    static isTaskActive(task: TaskType, fileType?: string | undefined): boolean {
        const isOptionFeature = task.optFeatureLabel ? Util.optionFeatures.includes(task.optFeatureLabel) : false;
        const isSupportType = task.filetypes ? (fileType ? task.filetypes.includes(fileType) : false) : true;
        const isShowDebug = !task.isDebug || task.isDebug && Util.isDebug;
        return (!task.inActive || isOptionFeature) && isShowDebug && Util.isSupportPlatform(task.platforms)  && isSupportType;
    }
}