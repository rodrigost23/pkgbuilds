import { PathLike } from 'fs'
import { readFile } from 'fs/promises'
import * as util from '../util'
import { Position } from './position'

interface Positions {
  checksums: Position
  pkgVer: Position
}

interface Variable {
  value: string
  position: Position
  /** Quote character to keep when the value is rewritten ('' for bare words) */
  quote: '' | "'" | '"'
}

export class PkgBuild {
  private readonly originalVariables: Map<string, string>

  private constructor(
    private readonly original: string,
    public pkgVer: string,
    public checksums: string[],
    readonly sources: string[],
    private readonly positions: Positions,
    private readonly variables: Map<string, Variable> = new Map()
  ) {
    this.originalVariables = new Map(
      [...variables].map(([name, variable]) => [name, variable.value])
    )
  }

  static async read(input: string): Promise<PkgBuild> {
    const tree = (await util.getParser()).parse(input)
    const sources: string[] = []
    const checksums: string[] = []
    const variables = new Map<string, Variable>()
    let checksumsPosition: Position | undefined
    let pkgVerPosition: Position | undefined
    let pkgVer: string | undefined

    for (const node of tree.rootNode.descendantsOfType('variable_assignment')) {
      const lhs = node.firstNamedChild
      const rhs = node.lastNamedChild
      if (
        lhs?.text.startsWith('pkgver') &&
        rhs?.type &&
        ['word', 'string', 'raw_string'].includes(rhs?.type)
      ) {
        pkgVer = rhs.text

        pkgVerPosition = {
          start: rhs.startPosition,
          end: rhs.endPosition
        }
      }
      if (lhs?.text.startsWith('source') && rhs?.type === 'array') {
        sources.push(...(util.parseNode(rhs, true) as string[]))
      }
      if (lhs?.text.startsWith('sha256sum') && rhs?.type === 'array') {
        checksums.push(...(util.parseNode(rhs, true) as string[]))
        checksumsPosition = {
          start: rhs.startPosition,
          end: rhs.endPosition
        }
      }

      // Track top-level scalar assignments so they can be rewritten by name
      // (e.g. `pkgrel`, or helper variables used inside `source`)
      if (
        lhs &&
        rhs &&
        node.parent?.type === 'program' &&
        !variables.has(lhs.text) &&
        ['word', 'string', 'raw_string'].includes(rhs.type)
      ) {
        const quote =
          rhs.type === 'raw_string' ? "'" : rhs.type === 'string' ? '"' : ''
        variables.set(lhs.text, {
          value: String(util.parseNode(rhs)),
          position: { start: rhs.startPosition, end: rhs.endPosition },
          quote
        })
      }
    }

    if (!pkgVer || !pkgVerPosition) {
      throw new Error('Could not parse pkgVer')
    }
    if (!checksums.length || !checksumsPosition) {
      throw new Error('Could not parse checksums')
    }
    if (!sources.length) {
      throw new Error('Could not parse sources')
    }

    const positions = {
      checksums: checksumsPosition,
      pkgVer: pkgVerPosition
    }

    return new PkgBuild(input, pkgVer, checksums, sources, positions, variables)
  }

  static async readFile(path: PathLike): Promise<PkgBuild> {
    return PkgBuild.read(await readFile(path, 'utf-8'))
  }

  /** Gets the value of a top-level scalar variable, if it exists. */
  getVariable(name: string): string | undefined {
    return this.variables.get(name)?.value
  }

  /**
   * Sets the value of an existing top-level scalar variable, keeping its
   * quoting style. Applied on {@link stringify}.
   *
   * @throws {Error} If the variable is not assigned in the PKGBUILD
   */
  setVariable(name: string, value: string): void {
    const variable = this.variables.get(name)
    if (!variable) {
      throw new Error(`Variable ${name} not found in PKGBUILD`)
    }
    variable.value = value
  }

  /**
   * Updates the version and the variables derived from upstream, and the
   * package release accordingly: a new version starts at pkgrel 1, and a
   * change of derived variables alone (e.g. another upstream tag for the same
   * version) bumps pkgrel so the new package is published.
   *
   * @param version - The new pkgver
   * @param vars - Variables to set, by name; they must exist in the PKGBUILD
   * @throws {Error} If a variable is not assigned in the PKGBUILD
   */
  update(version: string, vars: Record<string, string> = {}): void {
    const previous = this.pkgVer.replace(/^(['"])(.*)\1$/, '$2')
    const varsChanged = Object.entries(vars).some(
      ([name, value]) => this.getVariable(name) !== value
    )

    this.pkgVer = version
    for (const [name, value] of Object.entries(vars)) {
      this.setVariable(name, value)
    }

    const pkgrel = this.getVariable('pkgrel')
    if (pkgrel === undefined) {
      return
    }
    if (version !== previous) {
      this.setVariable('pkgrel', '1')
    } else if (varsChanged && /^\d+$/.test(pkgrel)) {
      this.setVariable('pkgrel', String(Number(pkgrel) + 1))
    }
  }

  stringify(): string {
    const replacements: { position: Position; value: string }[] = [
      { position: this.positions.pkgVer, value: this.pkgVer },
      {
        position: this.positions.checksums,
        value: `('${this.checksums.join("' '")}')`
      }
    ]

    for (const [name, variable] of this.variables) {
      if (variable.value !== this.originalVariables.get(name)) {
        replacements.push({
          position: variable.position,
          value: `${variable.quote}${variable.value}${variable.quote}`
        })
      }
    }

    // Apply from the bottom up so a replacement that changes the number of
    // lines (e.g. multi-line checksums) doesn't shift later positions
    replacements.sort(
      (a, b) =>
        b.position.start.row - a.position.start.row ||
        b.position.start.column - a.position.start.column
    )

    let result = this.original
    for (const { position, value } of replacements) {
      result = util.replaceValue({ original: result, position, value })
    }
    return result
  }
}
