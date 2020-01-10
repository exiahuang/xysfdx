export class ExtConst {
    public static readonly extName: string = "xysfdx";
    public static readonly maxBuffer: number = 1024 * 1024 * 20;
    public static readonly encoding: string = 'UTF-8';
    public static readonly showStatusbar: boolean = true;
    public static readonly statusbarIcon: string = "$(zap)";
    public static readonly isLoadHomeConfig: boolean = false;
    public static readonly isRegistConfigCommand: boolean = false;
    public static readonly isShowMessage: boolean = true;
    public static readonly message = `Thank you for using ${ExtConst.extName}. https://github.com/exiahuang/${ExtConst.extName}`;
	public static readonly userConfigKeyList: Array<string> = ["maxBuffer", "encoding"];
}