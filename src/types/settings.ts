export interface HostConfig{
    host: string;
    token: string;
}

export interface StoredSettings{
    debugEnabled: boolean;
    debugStackIncluded: boolean;
    hosts: Array<HostConfig>;
}