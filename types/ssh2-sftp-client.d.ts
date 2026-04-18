declare module 'ssh2-sftp-client' {
  export interface SftpFileInfo {
    name: string
    type: string
    size?: number
    modifyTime?: number
    accessTime?: number
    rights?: { user: string; group: string; other: string }
  }

  export default class SftpClient {
    connect(config: Record<string, unknown>): Promise<void>
    end(): Promise<void>
    fastGet(remotePath: string, localPath: string): Promise<void>
    list(remotePath: string): Promise<SftpFileInfo[]>
    exists(remotePath: string): Promise<false | string>
    get(remotePath: string): Promise<Buffer>
    [key: string]: unknown
  }
}
