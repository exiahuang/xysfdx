import https from 'https';
import fs from 'fs';
import path from 'path';
import { Util } from './Util';

const SERVER_URL = "https://raw.githubusercontent.com/exiahuang/xycode-config/master/";
const CONFIG_DESC_URL = `${SERVER_URL}/config.json`;

export interface ConfigDesc {
  name: string;
  label: string;
  description: string;
  platform: string[];
}

export class ConfigManager{
    private backupDir : string;
    private platform: string;
    private config_root_url: string;

    constructor(){
      this.backupDir = Util.backupdir;
      if(process.platform==='win32'){
        this.platform = "windows";
      } else if(process.platform==='darwin'){
        this.platform = "mac";
      } else if(process.platform==='linux'){
        this.platform = "linux";
      } else{
        throw new Error("not support your platform");
      }
      this.config_root_url = `${SERVER_URL}/${this.platform}`;
    }

    public async getData(url: string) : Promise<any>{
        return new Promise((resolve, reject) => {
            var req = https.request(url, (res) => {
              if (!res.statusCode || res.statusCode < 200 || res.statusCode > 299) { 
                reject(`HTTPS Request error ! statusCode ${res.statusCode}`);
              }
              else {
                let _data = "";
                res.on('data', (data) => {
                    _data += data;
                });
                res.on('end', () => {
                  resolve(_data);
                });
              }
            });
            req.on('error', (err) => {
              reject(err);
            });
            req.end();
        }); 
    }

    public async getConfigList() : Promise<Array<ConfigDesc> | undefined>{
      const data = await this.getData(CONFIG_DESC_URL);
      const configList: Array<ConfigDesc> = JSON.parse(data);
      return configList.filter(desc => desc.platform.includes(this.platform));
    }

    public async download(desc:ConfigDesc) : Promise<any>{
        const data = await this.getData(`${this.config_root_url}/${desc.name}`);
        const saveDir = Util.configdir;
        if(!fs.existsSync(saveDir)){
          fs.mkdirSync(saveDir);
        }
        const saveFilePath = path.join(saveDir, desc.name);
        this.backup(saveFilePath, path.join(this.backupDir, desc.name));
        fs.writeFileSync(saveFilePath, data);
    }

    private backup(srcFilePath: string, destFilePath: string){
      if(fs.existsSync(srcFilePath)){
          if(!fs.existsSync(this.backupDir)){
            fs.mkdirSync(this.backupDir);
          }
          fs.copyFileSync(srcFilePath, destFilePath);
      }
    }

}
