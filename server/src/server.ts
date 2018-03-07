/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

// import * as vscode from 'vscode';

import { debounce } from 'lodash';

import { PerlLinter } from './PerlLinter';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
const linter: PerlLinter = new PerlLinter('perl', [], [], [], '',[],'');
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
		}
	
}});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(debounce((change) => {
	validateTextDocument(change.document);

}, 1500));

// The settings interface describe the server relevant settings part
interface Settings {
	perlSyntax: PerlSyntaxSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface PerlSyntaxSettings {
	perlExecutable: string,
	includePaths: string[],
	prependCode: string[],
	additionalOptions: string[],
	relativePaths: string[],
	cwd: string,

}

let settin

// hold the maxNumberOfProblems setting
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	// maxNumberOfProblems = settings.perlSyntax.maxNumberOfProblems || 100;
	linter.perlExecutable = settings.perlSyntax.perlExecutable;
	linter.includePaths = settings.perlSyntax.includePaths;
	linter.perlOptions = settings.perlSyntax.additionalOptions;
	linter.prependCode = settings.perlSyntax.prependCode;
	linter.workspaceRoot = workspaceRoot;
	linter.relativePaths = settings.perlSyntax.relativePaths;
	linter.cwd = settings.perlSyntax.cwd;
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});


function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	let lines = textDocument.getText().split(/\r?\n/g);
	let problems = 0;
	linter.lint(textDocument.uri, textDocument.getText(), (diags: Diagnostic[]) => {
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diags });
	});
}

connection.onDidChangeWatchedFiles((change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});


// This handler provides the initial list of the completion items.
// connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
// 	// The pass parameter contains the position of the text document in 
// 	// which code complete got requested. For the example we ignore this
// 	// info and always provide the same completion items.
// 	return [
// 		{
// 			label: 'TypeScript',
// 			kind: CompletionItemKind.Text,
// 			data: 1
// 		},
// 		{
// 			label: 'JavaScript',
// 			kind: CompletionItemKind.Text,
// 			data: 2
// 		}
// 	]
// });

// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
// 	if (item.data === 1) {
// 		item.detail = 'TypeScript details',
// 		item.documentation = 'TypeScript documentation'
// 	} else if (item.data === 2) {
// 		item.detail = 'JavaScript details',
// 		item.documentation = 'JavaScript documentation'
// 	}
// 	return item;
// });

let t: Thenable<string>;

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.textDocument.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.textDocument.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.textDocument.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();