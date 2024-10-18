import fs from "fs";

export class CrosswordVariable {
  static ACROSS = "across";
  static DOWN = "down";

  i: number;
  j: number;
  direction: string;
  length: number;
  cells: [number, number][];
  id: string;

  constructor(i: number, j: number, direction: string, length: number) {
    this.i = i;
    this.j = j;
    this.direction = direction;
    this.length = length;
    this.cells = [];

    for (let k = 0; k < this.length; k++) {
      this.cells.push([
        this.i + (this.direction === CrosswordVariable.DOWN ? k : 0),
        this.j + (this.direction === CrosswordVariable.ACROSS ? k : 0),
      ]);
    }
    this.id = `${i}-${j}-${direction}-${length}`;
  }

  equals(other: CrosswordVariable): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return this.id;
  }
}

export class Crossword {
  height: number;
  width: number;
  structure: boolean[][];
  words: Map<number, Set<string>>;
  variables: Set<CrosswordVariable>;
  variableMap: Map<string, CrosswordVariable>;
  overlaps: Map<string, [number, number] | null>;

  constructor(structureFile: string, wordsFile: string) {
    this.structure = [];
    this.words = new Map();
    this.variables = new Set();
    this.overlaps = new Map();
    this.variableMap = new Map();

    this.height = 0;
    this.width = 0;

    this.loadStructure(structureFile);
    this.loadWords(wordsFile);
    this.findVariables();
    this.computeOverlaps();
  }

  private loadStructure(file: string): void {
    const data = fs.readFileSync(file, "utf8").split("\n");
    this.height = data.length;
    this.width = Math.max(...data.map((line) => line.length)) - 1;

    for (let i = 0; i < this.height; i++) {
      const row: boolean[] = [];
      for (let j = 0; j < this.width; j++) {
        row.push(data[i][j] === "?");
      }
      this.structure.push(row);
    }
  }

  private loadWords(file: string): void {
    const mapWords = new Map<number, Set<string>>();

    fs.readFileSync(file, "utf8")
      .toUpperCase()
      .split(/\r?\n/)
      .map((word) => {
        const toUpdate = mapWords.get(word.length);

        if (toUpdate) {
          if (!toUpdate.has(word)) {
            toUpdate.add(word);
          }
        } else {
          mapWords.set(word.length, new Set(word));
        }
      });

    this.words = mapWords;
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
            const variable = new CrosswordVariable(
              i,
              j,
              CrosswordVariable.DOWN,
              length
            );
            this.variables.add(variable);
            this.variableMap.set(variable.id, variable);
          }
        }

        if (this.structure[i][j] && (j === 0 || !this.structure[i][j - 1])) {
          let length = 1;
          for (let k = j + 1; k < this.width && this.structure[i][k]; k++) {
            length++;
          }
          if (length > 1) {
            const variable = new CrosswordVariable(
              i,
              j,
              CrosswordVariable.ACROSS,
              length
            );
            this.variables.add(variable);
            this.variableMap.set(variable.id, variable);
          }
        }
      }
    }
  }

  //GERADO COM IA
  private computeOverlaps(): void {
    for (const v1 of this.variables) {
      for (const v2 of this.variables) {
        if (v1 !== v2) {
          const overlap = this.getOverlap(v1, v2);
          this.overlaps.set(`${v1.id}-${v2.id}`, overlap);
        }
      }
    }
  }

  private getOverlap(
    v1: CrosswordVariable,
    v2: CrosswordVariable
  ): [number, number] | null {
    for (let idx1 = 0; idx1 < v1.cells.length; idx1++) {
      const [i1, j1] = v1.cells[idx1];
      for (let idx2 = 0; idx2 < v2.cells.length; idx2++) {
        const [i2, j2] = v2.cells[idx2];
        if (i1 === i2 && j1 === j2) {
          return [idx1, idx2];
        }
      }
    }
    return null;
  }
  // FIM GERADO COM IA

  neighbors(variable: CrosswordVariable): CrosswordVariable[] {
    return Array.from(this.variables).filter(
      (v) =>
        v !== variable && this.overlaps.get(`${variable.id}-${v.id}`) !== null
    );
  }

  getVariableById(id: string): CrosswordVariable | undefined {
    return this.variableMap.get(id);
  }
}
