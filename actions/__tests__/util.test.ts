import { initializeParser } from 'bash-language-server/out/parser'
import * as Parser from 'web-tree-sitter'
import * as util from '../src/util'

function getValue(input: string): Parser.SyntaxNode | null {
  return (
    parser.parse(`var=${input}`).rootNode.namedChild(0)?.lastNamedChild ?? null
  )
}

let parser: Parser
beforeAll(async () => {
  parser = await initializeParser()
})

describe('parseNode', () => {
  it('should return string without quotation marks', async () => {
    const singleQuotes = getValue("'string'")
    const doubleQuotes = getValue('"string"')

    expect(util.parseNode(singleQuotes)).toStrictEqual('string')
    expect(util.parseNode(doubleQuotes)).toStrictEqual('string')
  })

  it('should return parsed integer', async () => {
    const word = getValue('1')
    expect(util.parseNode(word)).toStrictEqual(1)
  })

  it('should not parse float', async () => {
    const word = getValue('1.5')
    expect(util.parseNode(word)).toStrictEqual('1.5')
  })

  it('should return array of values', async () => {
    const array = getValue('( 23 "str" \'raw\' )')
    expect(util.parseNode(array)).toStrictEqual([23, 'str', 'raw'])
  })

  it('should return null for empty node', async () => {
    const empty = getValue('')
    expect(util.parseNode(empty)).toBe('')
  })

  it('should return null for undefined node', async () => {
    expect(() => {
      util.parseNode(null)
    }).toThrow()
  })
})
