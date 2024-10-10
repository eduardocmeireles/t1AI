import fs from 'fs';
import { Crossword, CrosswordVariable } from './Crossword';

export class CrosswordCreator {
    crossword: Crossword;
    domains: Map<string, Set<string>>;
    steps: string[];

    constructor(crossword: Crossword) {
        this.crossword = crossword;
        this.domains = new Map();
        this.steps = [];

        for (const variable of this.crossword.variables) {
            const wordsOfCorrectLength = new Set<string>();

            for (const word of this.crossword.words) {
                if (word.length === variable.length) {
                    wordsOfCorrectLength.add(word);
                }
            }
            this.domains.set(variable.id, wordsOfCorrectLength);
        }
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
                    row += '.';
                }
            }
            output.push(row);
        }

        fs.writeFileSync(filename, output.join('\n'), 'utf8');
    }

    letterGrid(assignment: Map<string, string>): (string | null)[][] {
        const letters: (string | null)[][] = Array.from(
            { length: this.crossword.height },
            () => Array(this.crossword.width).fill(null)
        );

        for (const [varId, word] of assignment.entries()) {
            const variable = this.crossword.getVariableById(varId)!;
            for (let k = 0; k < word.length; k++) {
                const [i, j] = variable.cells[k];
                letters[i][j] = word[k];
            }
        }

        return letters;
    }

    saveSteps(filename: string): void {
        fs.writeFileSync(filename, this.steps.join('\n'), 'utf8');
    }

    solve(): Map<string, string> | null {
        console.time('Tempo para resolver'); 

        if (!this.ac3()) {
            return null;
        }

        const result = this.backtrack(new Map());

        if (result !== null) {
            this.saveSteps('solution_steps.txt');
        }

        console.timeEnd('Tempo para resolver'); 
        return result;
    }

    private ac3(): boolean {
        const queue: [string, string][] = [];

        for (const variable of this.crossword.variables) {
            const varId1 = variable.id;
            for (const neighbor of this.crossword.neighbors(variable)) {
                const varId2 = neighbor.id;
                queue.push([varId1, varId2]);
            }
        }

        while (queue.length > 0) {
            const [xId, yId] = queue.pop()!;
            if (this.revise(xId, yId)) {
                if (this.domains.get(xId)!.size === 0) {
                    return false;
                }
                const xVariable = this.crossword.getVariableById(xId)!;
                for (const neighbor of this.crossword.neighbors(xVariable)) {
                    const zId = neighbor.id;
                    if (zId !== yId) {
                        queue.push([zId, xId]);
                    }
                }
            }
        }

        return true;
    }

    private revise(xId: string, yId: string): boolean {
        const overlap = this.crossword.overlaps.get(`${xId}-${yId}`);

        if (!overlap) {
            return false;
        }

        const [i, j] = overlap;
        const domainX = this.domains.get(xId)!;
        const domainY = this.domains.get(yId)!;

        let revised = false;
        const toRemove: string[] = [];

        for (const valX of domainX) {
            let found = false;
            for (const valY of domainY) {
                if (valX[i] === valY[j]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                toRemove.push(valX);
                revised = true;
            }
        }

        for (const val of toRemove) {
            domainX.delete(val);
        }

        return revised;
    }

    private backtrack(assignment: Map<string, string>): Map<string, string> | null {
        if (this.assignmentComplete(assignment)) {
            return assignment;
        }

        const variable = this.selectUnassignedVariable(assignment);
        const varId = variable.id;
        const domainValues = Array.from(this.domains.get(varId)!);

        for (const value of this.orderDomainValues(variable, assignment, domainValues)) {
            this.steps.push(`Trying to assign word '${value}' to variable '${varId}'`);
            assignment.set(varId, value);

            if (this.consistent(variable, assignment)) {
                this.steps.push(`Assigned word '${value}' to variable '${varId}'`);

                const result = this.backtrack(assignment);
                if (result !== null) {
                    return result;
                }

                this.steps.push(`Backtracking on variable '${varId}', removing word '${value}'`);
            } else {
                this.steps.push(
                    `Failed to assign word '${value}' to variable '${varId}' (inconsistent), backtracking`
                );
            }
            assignment.delete(varId);
        }

        return null;
    }

    private assignmentComplete(assignment: Map<string, string>): boolean {
        return assignment.size === this.crossword.variables.size;
    }

    private consistent(variable: CrosswordVariable, assignment: Map<string, string>): boolean {
        const value = assignment.get(variable.id)!;

        if (value.length !== variable.length) {
            return false;
        }

        for (const [varId, assignedValue] of assignment.entries()) {
            if (varId !== variable.id && assignedValue === value) {
                return false;
            }
        }

        for (const neighbor of this.crossword.neighbors(variable)) {
            const neighborValue = assignment.get(neighbor.id);
            if (neighborValue) {
                const overlap = this.crossword.overlaps.get(`${variable.id}-${neighbor.id}`);
                if (overlap) {
                    const [i, j] = overlap;
                    if (value[i] !== neighborValue[j]) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private orderDomainValues(
        variable: CrosswordVariable,
        assignment: Map<string, string>,
        domainValues: string[]
    ): string[] {
        const varId = variable.id;
        const unassignedNeighbors = this.crossword.neighbors(variable).filter(
            neighbor => !assignment.has(neighbor.id)
        );

        const valueConstraints: Map<string, number> = new Map();

        for (const value of domainValues) {
            let constraintCount = 0;

            for (const neighbor of unassignedNeighbors) {
                const neighborId = neighbor.id;
                const overlap = this.crossword.overlaps.get(`${varId}-${neighborId}`);
                if (overlap) {
                    const [i, j] = overlap;
                    const neighborDomain = this.domains.get(neighborId)!;

                    let consistentValues = 0;
                    for (const neighborValue of neighborDomain) {
                        if (value[i] === neighborValue[j]) {
                            consistentValues++;
                        }
                    }

                    constraintCount += neighborDomain.size - consistentValues;
                }
            }

            valueConstraints.set(value, constraintCount);
        }

        return domainValues.sort((a, b) => valueConstraints.get(a)! - valueConstraints.get(b)!);
    }

    private selectUnassignedVariable(assignment: Map<string, string>): CrosswordVariable {
        const unassignedVariables = Array.from(this.crossword.variables).filter(
            v => !assignment.has(v.id)
        );

        unassignedVariables.sort((a, b) => {
            const domainSizeA = this.domains.get(a.id)!.size;
            const domainSizeB = this.domains.get(b.id)!.size;

            if (domainSizeA !== domainSizeB) {
                return domainSizeA - domainSizeB;
            }

            const degreeA = this.crossword.neighbors(a).filter(neighbor => !assignment.has(neighbor.id)).length;
            const degreeB = this.crossword.neighbors(b).filter(neighbor => !assignment.has(neighbor.id)).length;

            return degreeB - degreeA;
        });

        return unassignedVariables[0];
    }
}