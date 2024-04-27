import { PathLike } from 'fs'
import { readFile } from 'fs/promises'
import { isObject as isRecord } from '../util'
import { PackageConfig } from './pkgconfig'

export interface IConfig {
  packages: {
    [name: string]: PackageConfig
  }
}

export class Config implements IConfig {
  private constructor(
    readonly packages: {
      [name: string]: PackageConfig
    }
  ) {}
  static isValidConfig(obj: unknown): obj is IConfig {
    if (!isRecord(obj)) {
      return false
    }

    if (!obj.packages || typeof obj.packages !== 'object') {
      return false
    }

    for (const pkg of Object.values(obj.packages)) {
      if (!PackageConfig.isValidConfig(pkg)) {
        return false
      }
    }

    return true
  }

  /**
   * Reads a configuration from a JSON string and returns a Config object.
   *
   * @param input The JSON string to parse.
   * @returns The parsed {@link Config} object.
   * @throws {Error} If the provided JSON is not a valid Config.
   */
  static read(input: string): Config {
    const config = JSON.parse(input) as IConfig
    if (Config.isValidConfig(config)) {
      return new Config(config.packages)
    }

    throw new Error('Invalid config')
  }

  /**
   * Reads a configuration from a file and returns a Config object.
   *
   * @param path The path to the config file.
   * @returns The parsed {@link Config} object.
   */
  static async readFile(path: PathLike): Promise<Config> {
    return Config.read(await readFile(path, 'utf-8'))
  }
}
