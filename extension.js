'use strict';

const vscode = require('vscode');
const { analyzeLine } = require('./lib/scan');
const { renderCard } = require('./lib/format');

const SECTION = 'numberLiteral';

function readOptions() {
  const config = vscode.workspace.getConfiguration(SECTION);
  return {
    width: config.get('width', '64-bit') === '32-bit' ? 'DWORD' : 'QWORD',
    endian: config.get('endianness', 'LITTLE ENDIAN') === 'BIG ENDIAN' ? 'BE' : 'LE'
  };
}

function activate(context) {
  context.subscriptions.push(vscode.languages.registerHoverProvider('*', {
    provideHover(document, position) {
      const line = document.lineAt(position.line);
      const match = analyzeLine(line.text, position.character);
      if (!match) return undefined;

      const markdown = new vscode.MarkdownString(renderCard(match, readOptions()));
      markdown.isTrusted = { enabledCommands: ['workbench.action.openSettings'] };
      return new vscode.Hover(
        markdown,
        new vscode.Range(position.line, match.start, position.line, match.end + 1)
      );
    }
  }));
}

module.exports = { activate };
