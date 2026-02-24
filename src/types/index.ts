/**
 * Типы для настроек и API
 */

export interface HostConfig {
  host: string;
  token: string;
}

export type Settings = {
  hosts: HostConfig[];
};
