
interface LauncherOptions {
    autoUpdate: boolean;
    logConsole: boolean;
    runnerThreads: number;
    processorCount: number;
    storageTimeout: number;
    logRotateKeep: number;
    restartInterval: number;
}

interface Config {
    steamKey: string;
    mods: string[];
    bots: Record<string, string>;
    launcherOptions: LauncherOptions;
}