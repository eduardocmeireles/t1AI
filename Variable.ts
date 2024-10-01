export class Variable {
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
                this.i + (this.direction === Variable.DOWN ? k : 0),
                this.j + (this.direction === Variable.ACROSS ? k : 0)
            ]);
        }
    }

    equals(other: Variable): boolean {
        return this.i === other.i && this.j === other.j && 
               this.direction === other.direction && this.length === other.length;
    }

    toString(): string {
        return `(${this.i}, ${this.j}) ${this.direction} : ${this.length}`;
    }
}
