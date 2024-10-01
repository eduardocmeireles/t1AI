import { Crossword, CrosswordVariable } from './Crossword';
import fs from 'fs';

export class CrosswordCreator {
    crossword: Crossword;
    domains: Map<string, Set<string>>;

    constructor(crossword: Crossword) {
        this.crossword = crossword;
        this.domains = new Map();
        crossword.variables.forEach(variable => {
            this.domains.set(variable.id, new Set([...crossword.words]));
        });
    }

    letterGrid(assignment: Map<string, string>): (string | null)[][] {
        const letters: (string | null)[][] = Array.from(
            { length: this.crossword.height }, 
            () => Array(this.crossword.width).fill(null)
        );
        for (const [varId, word] of assignment.entries()) {
            const variable = this.crossword.getVariableById(varId)!;
            const direction = variable.direction;
            for (let k = 0; k < word.length; k++) {
                const i = variable.i + (direction === CrosswordVariable.DOWN ? k : 0);
                const j = variable.j + (direction === CrosswordVariable.ACROSS ? k : 0);
                letters[i][j] = word[k];
            }
        }
        return letters;
    }

    save(assignment: Map<string, string>, filename: string): void {
        const letters = this.letterGrid(assignment);
        const output: string[] = [];

        for (let i = 0; i < this.crossword.height; i++) {
            let row = '';
            for (let j = 0; j < this.crossword.width; j++) {
                if (this.crossword.structure[i][j]) {
                    row += letters[i][j] || ' ';
                } else {
                    row += '.'; // Use a block character for black squares
                }
            }
            output.push(row);
        }

        // Save the result to the output file
        fs.writeFileSync(filename, output.join('\n'), 'utf8');
    }

    solve(): Map<string, string> | null {
        this.enforceNodeConsistency();
        if (!this.ac3()) {
            return null;
        }
        return this.backtrack(new Map());
    }

    private enforceNodeConsistency(): void {
        this.domains.forEach((domain, varId) => {
            const variable = this.crossword.getVariableById(varId)!;
            const toRemove = new Set<string>();
            domain.forEach(word => {
                if (word.length !== variable.length) {
                    toRemove.add(word);
                }
            });
            toRemove.forEach(word => domain.delete(word));
        });
    }

    private ac3(): boolean {
        const queue: [string, string][] = [];
        this.domains.forEach((_, varId1) => {
            this.domains.forEach((_, varId2) => {
                if (varId1 !== varId2) queue.push([varId1, varId2]);
            });
        });

        while (queue.length > 0) {
            const [xId, yId] = queue.shift()!;
            const x = this.crossword.getVariableById(xId)!;
            const y = this.crossword.getVariableById(yId)!;
            if (this.revise(x, y)) {
                if (this.domains.get(xId)!.size === 0) {
                    return false; // Empty domain, no possible solution
                }
                this.crossword.neighbors(x).forEach(z => {
                    if (z.id !== yId) queue.push([z.id, xId]);
                });
            }
        }
        return true;
    }

    private revise(x: CrosswordVariable, y: CrosswordVariable): boolean {
        const xId = x.id;
        const yId = y.id;
        const toRemove = new Set<string>();
        const overlaps = this.crossword.overlaps.get(`${xId}-${yId}`);

        if (overlaps) {
            for (const valX of this.domains.get(xId)!) {
                let consistent = false;
                for (const valY of this.domains.get(yId)!) {
                    if (valX[overlaps[0]] === valY[overlaps[1]]) {
                        consistent = true;
                        break;
                    }
                }
                if (!consistent) {
                    toRemove.add(valX);
                }
            }
        }

        toRemove.forEach(valX => this.domains.get(xId)!.delete(valX));
        return toRemove.size > 0;
    }

    private backtrack(assignment: Map<string, string>): Map<string, string> | null {
        if (this.assignmentComplete(assignment)) {
            return assignment;
        }

        const varToAssign = this.selectUnassignedVariable(assignment);
        const varId = varToAssign.id;
        for (const value of this.orderDomainValues(varToAssign, assignment)) {
            assignment.set(varId, value);
            if (this.consistent(assignment)) {
                const result = this.backtrack(assignment);
                if (result !== null) {
                    return result;
                }
            }
            assignment.delete(varId);
        }
        return null;
    }

    private assignmentComplete(assignment: Map<string, string>): boolean {
        for (const variable of this.crossword.variables) {
            if (!assignment.has(variable.id)) {
                return false;
            }
        }
        return true;
    }

    private consistent(assignment: Map<string, string>): boolean {
        const usedValues = new Set<string>();

        for (const [varId, value] of assignment.entries()) {
            if (usedValues.has(value)) {
                return false;
            }
            usedValues.add(value);

            const variable = this.crossword.getVariableById(varId)!;

            if (value.length !== variable.length) {
                return false;
            }

            for (const neighbor of this.crossword.neighbors(variable)) {
                if (assignment.has(neighbor.id)) {
                    const neighborValue = assignment.get(neighbor.id)!;
                    const overlaps = this.crossword.overlaps.get(`${varId}-${neighbor.id}`);
                    if (overlaps && value[overlaps[0]] !== neighborValue[overlaps[1]]) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private orderDomainValues(varToAssign: CrosswordVariable, assignment: Map<string, string>): string[] {
        const varId = varToAssign.id;
        const neighbors = this.crossword.neighbors(varToAssign);
        const domain = Array.from(this.domains.get(varId)!);

        return domain.sort((a, b) => {
            let countA = 0;
            let countB = 0;

            for (const neighbor of neighbors) {
                if (!assignment.has(neighbor.id)) {
                    const neighborDomain = this.domains.get(neighbor.id)!;
                    neighborDomain.forEach(value => {
                        if (a !== value) countA++;
                        if (b !== value) countB++;
                    });
                }
            }

            return countA - countB;
        });
    }

    private selectUnassignedVariable(assignment: Map<string, string>): CrosswordVariable {
        return Array.from(this.domains.keys())
            .filter(varId => !assignment.has(varId))
            .map(varId => this.crossword.getVariableById(varId)!)
            .sort((a, b) => {
                const domainA = this.domains.get(a.id)!.size;
                const domainB = this.domains.get(b.id)!.size;
                if (domainA !== domainB) {
                    return domainA - domainB;
                }
                return this.crossword.neighbors(b).length - this.crossword.neighbors(a).length;
            })[0];
    }
}
