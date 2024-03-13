import { SyntaxNode } from 'web-tree-sitter'

type ParsedNode = string | number | ParsedNode[]

export function parseNode(node: SyntaxNode | null, expand = false): ParsedNode {
  if (node?.type === 'raw_string') {
    return parseRawString(node)
  } else if (node?.type === 'string') {
    return parseString(node, expand)
  } else if (node?.type === 'word') {
    return parseWord(node)
  } else if (node?.type === 'array') {
    return parseArray(node, expand)
  } else {
    throw new Error(
      `Could not parse node. Type: ${node?.type}. Value: ${node?.text}`
    )
  }
}

function parseRawString(node: SyntaxNode): string {
  return node.text.replace(/^'(.*)'$/, '$1')
}

function parseString(node: SyntaxNode, expand: boolean): string {
  let str = node.text.replace(/^"(.*)"$/, '$1')

  if (expand) {
    str = expandString(node, str)
  }

  return str
}

function expandString(node: SyntaxNode, str: string): string {
  for (const expansion of node?.descendantsOfType('expansion') ?? []) {
    if (expansion.firstNamedChild?.type === 'variable_name') {
      const var_name = expansion.firstNamedChild?.text
      const value_node =
        node.tree.rootNode
          ?.descendantsOfType('variable_assignment')
          ?.find(n => n.firstNamedChild?.text === var_name)?.lastNamedChild ??
        null
      const value = parseNode(value_node)
      if (!Array.isArray(value)) {
        str = str.replace(expansion.text, value.toString())
      }
    }
  }
  return str
}

function parseWord(node: SyntaxNode): string | number {
  const integer = parseInt(node.text)
  return integer.toString() === node.text ? integer : node.text
}

function parseArray(node: SyntaxNode, expand: boolean): ParsedNode[] {
  return node.namedChildren.map(item => parseNode(item, expand))
}

export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x != null
}
