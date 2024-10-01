import { Crossword, CrosswordVariable } from './Crossword';
import * as fs from 'fs';

export class CrosswordCreator {
    crossword: Crossword;
    domains: Map<CrosswordVariable, Set<string>>;

    constructor(crossword: Crossword) {
        this.crossword = crossword;
        this.domains = new Map();
        crossword.variables.forEach(variable => {
            this.domains.set(variable, new Set([...crossword.words]));
        });
    }

    letterGrid(assignment: Map<CrosswordVariable, string>): (string | null)[][] {
        const letters: (string | null)[][] = Array.from(
            { length: this.crossword.height }, 
            () => Array(this.crossword.width).fill(null)
        );
        for (const [variable, word] of assignment.entries()) {
            const direction = variable.direction;
            for (let k = 0; k < word.length; k++) {
                const i = variable.i + (direction === CrosswordVariable.DOWN ? k : 0);
                const j = variable.j + (direction === CrosswordVariable.ACROSS ? k : 0);
                letters[i][j] = word[k];
            }
        }
        return letters;
    }

    save(assignment: Map<CrosswordVariable, string>, filename: string): void {
        const letters = this.letterGrid(assignment);
        const output: string[] = [];

        for (let i = 0; i < this.crossword.height; i++) {
            let row = '';
            for (let j = 0; j < this.crossword.width; j++) {
                if (this.crossword.structure[i][j]) {
                    row += letters[i][j] || ' ';
                } else {
                    row += '.';
                }
            }
            output.push(row);
        }

        // Save the result to the output file
        fs.writeFileSync(filename, output.join('\n'), 'utf8');
    }

    solve(): Map<CrosswordVariable, string> | null {
        this.enforceNodeConsistency();

        this.ac3(); // Enforce arc consistency

        return this.backtrack(new Map()); // Use backtracking to complete the rest
    }

    private enforceNodeConsistency(): void {
        this.domains.forEach((domain, variable) => {
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
        const queue: [CrosswordVariable, CrosswordVariable][] = [];
        this.domains.forEach((_, var1) => {
            this.domains.forEach((_, var2) => {
                if (var1 !== var2) queue.push([var1, var2]);
            });
        });

        while (queue.length > 0) {
            const [x, y] = queue.shift()!;
            if (this.revise(x, y)) {
                if (this.domains.get(x)!.size === 0) {
                    return false; // Empty domain, no possible solution
                }
                this.crossword.neighbors(x).forEach(z => {
                    if (z !== y) queue.push([z, x]);
                });
            }
        }
        return true;
    }

    private revise(x: CrosswordVariable, y: CrosswordVariable): boolean {
        const toRemove = new Set<string>();
        const overlaps = this.crossword.overlaps.get(`${x}-${y}`);

        if (overlaps) {
            for (const valX of this.domains.get(x)!) {
                let consistent = false;
                for (const valY of this.domains.get(y)!) {
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

        toRemove.forEach(valX => this.domains.get(x)!.delete(valX));
        return toRemove.size > 0;
    }

    private backtrack(assignment: Map<CrosswordVariable, string>): Map<CrosswordVariable, string> | null {
        if (this.assignmentComplete(assignment)) {
            return assignment;
        }

        const varToAssign = this.selectUnassignedVariable(assignment);
        for (const value of this.orderDomainValues(varToAssign, assignment)) {
            assignment.set(varToAssign, value);
            if (this.consistent(assignment)) {
                const result = this.backtrack(assignment);
                if (result !== null) {
                    return result;
                }
            }
            assignment.delete(varToAssign);
        }
        return null;
    }

    private assignmentComplete(assignment: Map<CrosswordVariable, string>): boolean {
        for (const variable of this.crossword.variables) {
            if (!assignment.has(variable)) {
                return false;
            }
        }
        return true;
    }

    private consistent(assignment: Map<CrosswordVariable, string>): boolean {
        const usedValues = new Set<string>();

        for (const [variable, value] of assignment.entries()) {
            if (usedValues.has(value)) {
                return false;
            }
            usedValues.add(value);

            if (value.length !== variable.length) {
                return false;
            }

            for (const neighbor of this.crossword.neighbors(variable)) {
                if (assignment.has(neighbor)) {
                    const neighborValue = assignment.get(neighbor)!;
                    const overlaps = this.crossword.overlaps.get(`${variable}-${neighbor}`);
                    if (overlaps && value[overlaps[0]] !== neighborValue[overlaps[1]]) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private orderDomainValues(varToAssign: CrosswordVariable, assignment: Map<CrosswordVariable, string>): string[] {
        const neighbors = this.crossword.neighbors(varToAssign);
        const domain = Array.from(this.domains.get(varToAssign)!);

        return domain.sort((a, b) => {
            let countA = 0;
            let countB = 0;

            for (const neighbor of neighbors) {
                if (!assignment.has(neighbor)) {
                    const neighborDomain = this.domains.get(neighbor)!;
                    neighborDomain.forEach(value => {
                        if (a !== value) countA++;
                        if (b !== value) countB++;
                    });
                }
            }

            return countA - countB;
        });
    }

    private selectUnassignedVariable(assignment: Map<CrosswordVariable, string>): CrosswordVariable {
        return Array.from(this.domains.keys())
            .filter(variable => !assignment.has(variable))
            .sort((a, b) => {
                const domainA = this.domains.get(a)!.size;
                const domainB = this.domains.get(b)!.size;
                if (domainA !== domainB) {
                    return domainA - domainB;
                }
                return this.crossword.neighbors(b).length - this.crossword.neighbors(a).length;
            })[0];
    }
}

module.exports = { CrosswordCreator };
