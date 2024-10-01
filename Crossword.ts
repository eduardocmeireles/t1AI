import * as fs from 'fs';

export class CrosswordVariable {
    static ACROSS = "across";
    static DOWN = "down";

    i: number;
    j: number;
    direction: string;
    length: number;
    cells: [number, number][];

    constructor(i: number, j: number, direction: string, length: number) {
        this.i = i;
        this.j = j;
        this.direction = direction;
        this.length = length;
        this.cells = [];

        for (let k = 0; k < this.length; k++) {
            this.cells.push([
                this.i + (this.direction === CrosswordVariable.DOWN ? k : 0),
                this.j + (this.direction === CrosswordVariable.ACROSS ? k : 0)
            ]);
        }
    }

    equals(other: CrosswordVariable): boolean {
        return this.i === other.i && this.j === other.j && 
               this.direction === other.direction && this.length === other.length;
    }

    toString(): string {
        return `(${this.i}, ${this.j}) ${this.direction} : ${this.length}`;
    }
}

export class Crossword {
    height: number;
    width: number;
    structure: boolean[][];
    words: Set<string>;
    variables: Set<CrosswordVariable>;
    overlaps: Map<string, [number, number] | null>;

    constructor(structureFile: string, wordsFile: string) {
        this.structure = [];
        this.words = new Set();
        this.variables = new Set();
        this.overlaps = new Map();
        
        this.height = 0;
        this.width = 0;

        this.loadStructure(structureFile);
        this.loadWords(wordsFile);
        this.findVariables();
        this.computeOverlaps();
    }

    private loadStructure(file: string): void {
        const data = fs.readFileSync(file, 'utf8').split('\n');
        this.height = data.length;
        this.width = Math.max(...data.map(line => line.length));

        for (let i = 0; i < this.height; i++) {
            const row: boolean[] = [];
            for (let j = 0; j < this.width; j++) {
                row.push(data[i][j] === '?');
            }
            this.structure.push(row);
        }
    }

    private loadWords(file: string): void {
        const data = fs.readFileSync(file, 'utf8').toUpperCase().split('\n');
        this.words = new Set(data);
    }

    private findVariables(): void {
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                if (this.structure[i][j] && (i === 0 || !this.structure[i - 1][j])) {
                    let length = 1;
                    for (let k = i + 1; k < this.height && this.structure[k][j]; k++) {
                        length++;
                    }
                    if (length > 1) {
                        this.variables.add(new CrosswordVariable(i, j, CrosswordVariable.DOWN, length));
                    }
                }

                if (this.structure[i][j] && (j === 0 || !this.structure[i][j - 1])) {
                    let length = 1;
                    for (let k = j + 1; k < this.width && this.structure[i][k]; k++) {
                        length++;
                    }
                    if (length > 1) {
                        this.variables.add(new CrosswordVariable(i, j, CrosswordVariable.ACROSS, length));
                    }
                }
            }
        }
    }

    private computeOverlaps(): void {
        for (const v1 of this.variables) {
            for (const v2 of this.variables) {
                if (v1 !== v2) {
                    const overlap = this.getOverlap(v1, v2);
                    if (overlap) {
                        this.overlaps.set(`${v1}-${v2}`, overlap);
                    } else {
                        this.overlaps.set(`${v1}-${v2}`, null);
                    }
                }
            }
        }
    }

    private getOverlap(v1: CrosswordVariable, v2: CrosswordVariable): [number, number] | null {
        for (let [i1, j1] of v1.cells) {
            for (let [i2, j2] of v2.cells) {
                if (i1 === i2 && j1 === j2) {
                    return [v1.cells.indexOf([i1, j1]), v2.cells.indexOf([i2, j2])];
                }
            }
        }
        return null;
    }

    neighbors(variable: CrosswordVariable): CrosswordVariable[] {
        return Array.from(this.variables).filter(v => v !== variable && this.overlaps.get(`${variable}-${v}`) !== null);
    }
}

module.exports = { Crossword, CrosswordVariable };
