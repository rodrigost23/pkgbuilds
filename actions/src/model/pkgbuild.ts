import { initializeParser } from 'bash-language-server/out/parser'
import * as util from '../util'
// import * as Parser from 'web-tree-sitter'

export class PkgBuild {
  private constructor(public sources: string[]) {}

  // private _parser: Parser | undefined

  // /**
  //  * Gets the parser instance, initializing it if needed.
  //  * Returns a Promise that resolves to the Parser instance.
  //  */
  // public get parser() {
  //   return new Promise<Parser>(resolve => {
  //     if (this._parser !== undefined) {
  //       resolve(this._parser)
  //     }
  //     initializeParser().then(parser => {
  //       this._parser = parser
  //       resolve(parser)
  //     })
  //   })
  // }

  static async read(input: string): Promise<PkgBuild> {
    const parser = await initializeParser()
    const tree = parser.parse(input)
    const sources: string[] = []
    for (const node of tree.rootNode.descendantsOfType('variable_assignment')) {
      const lhs = node.firstNamedChild
      const rhs = node.lastNamedChild
      if (lhs?.text.startsWith('source') && rhs?.type === 'array') {
        sources.push(...(util.parseNode(rhs, true) as string[]))
      }
    }
    return new PkgBuild(sources)
  }
}
