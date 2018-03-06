import * as childProcess from 'child_process';
import * as _ from 'lodash';
import { Diagnostic, Range, Position, DiagnosticSeverity } from 'vscode-languageserver';

const LINE_REGEX = /line (\d*)[\.,]/;

interface DocumentProcess {
    [document: string]: childProcess.ChildProcess;
};

export class PerlLinter {
    private documentProcesses: DocumentProcess;

    constructor(
        public perlExecutable: string,
        public includePaths: string[],
        public perlOptions: string[],
        public prependCode: string[],
        public workspaceRoot: string,
        public relativePaths: string[],
        public cwd: string,
    ) {
        this.documentProcesses = {};
    }

    lint(uri: string, text: string, callback: (diag: Diagnostic[]) => void) : void {
        const diagnostics: Diagnostic[] = [];

        let process: childProcess.ChildProcess = this.documentProcesses[uri];

        if (process) {
            process.kill('SIGINT');
        }
        var process_1 = require('process');
        var olddir = process_1.cwd();
        // console.log("olddir: "+olddir);
        if (this.cwd)
        {
            console.log("cd to: "+this.workspaceRoot+"/"+this.cwd);
            try {
                process_1.chdir(this.workspaceRoot+'/'+this.cwd);
            }
            catch(e){
                console.log(e);
            }
        }

        this.documentProcesses[uri] = process = childProcess.spawn(
            this.perlExecutable,
            ['-c', ...this.perlOptions, ...this.includePaths.map(path => '-I' + path),
            ...this.relativePaths.map(path=>'-I'+this.workspaceRoot+'/'+path)]
        );

        process.stdin.on('error', (err: Error) => {
            if (diagnostics.length === 0) {
                throw new Error(`No diagnostics were produced on perl exit: ${err.message}`);
            }
        });

        process.addListener('exit', function(code: number, signal: string) {
            callback(diagnostics);    
        });   

        process.stderr.on('data', (lineBuf) => {
            const lineStr: string = lineBuf.toString();
            const lines: string[] = lineStr.split('\n');
            let lastErrorLineNum = 0;
            lines.forEach((line, index) => {
                if(line.match(LINE_REGEX)) {
                    let lineNum = this.extractLineNumber(line) - 1;
                    if(!isNaN(lineNum)) {
                        const diagnostic: Diagnostic = Diagnostic.create(
                            Range.create(
                                Position.create(lineNum, 0),
                                Position.create(lineNum, line.length)
                            ),
                            line,
                            DiagnosticSeverity.Error
                        );
                        diagnostics.push(diagnostic);
                        lastErrorLineNum = lineNum;
                    }
                }    
                if(line.match(/has too many errors\.$/)) {
                    const diagnostic: Diagnostic = Diagnostic.create(
                        Range.create(
                            Position.create(lastErrorLineNum, 0),
                            Position.create(lastErrorLineNum, line.length)
                        ),
                        line,
                        DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            });     
        });
        
        process.stdin.write(this.prependCode.join(''));
        process.stdin.write(text);
        process.stdin.end("\x04");
        try {
            process_1.chdir(olddir);
        } 
        catch(e){
            console.log(e);
        }
    }

    private extractLineNumber(line: string): number {
        const matches = line.match(LINE_REGEX);
        return parseInt(matches[1]);       
    }
}