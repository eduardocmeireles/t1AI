import fs from "fs";
import { Crossword, CrosswordVariable } from "./Crossword";

export class CrosswordCreator {
  crossword: Crossword;
  domains: Map<string, Set<string>>;
  steps: string[];

  variableDegrees: Map<string, number>;

  constructor(crossword: Crossword) {
    this.crossword = crossword;
    this.domains = new Map();
    this.steps = [];
    this.variableDegrees = new Map();

    for (const variable of this.crossword.variables) {
      const domainWithLength = this.crossword.words.get(variable.length);

      if (domainWithLength) {
        this.domains.set(variable.id, domainWithLength);
      }

      const degree = this.crossword.neighbors(variable).length;
      this.variableDegrees.set(variable.id, degree);
    }
  }

  save(assignment: Map<string, string>, filename: string): void {
    const letters = this.letterGrid(assignment);
    const output: string[] = [];

    for (let i = 0; i < this.crossword.height; i++) {
      let row = "";
      for (let j = 0; j < this.crossword.width; j++) {
        if (this.crossword.structure[i][j]) {
          row += letters[i][j] || " ";
        } else {
          row += ".";
        }
      }
      output.push(row);
    }

    fs.writeFileSync(filename, output.join("\n"), "utf8");
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
    fs.writeFileSync(filename, this.steps.join("\n"), "utf8");
  }

  solve(): Map<string, string> | null {
    console.time("Tempo para resolver");

    // Inicialização dos domínios para uso no forward checking
    const assignment = new Map<string, string>();
    const result = this.backtrack(assignment);

    if (result !== null) {
      this.saveSteps("solution_steps.txt");
    }

    console.timeEnd("Tempo para resolver");
    return result;
  }

  private backtrack(
    assignment: Map<string, string>
  ): Map<string, string> | null {
    if (this.assignmentComplete(assignment)) {
      return assignment;
    }

    const variable = this.selectUnassignedVariable(assignment);
    const varId = variable.id;
    const domainValues = Array.from(this.domains.get(varId)!);

    for (const value of this.orderDomainValues(
      variable,
      assignment,
      domainValues
    )) {
      this.steps.push(
        `Trying to assign word '${value}' to variable '${varId}'`
      );

      assignment.set(varId, value);

      if (this.consistent(variable, assignment)) {
        const inferences = new Map<string, Set<string>>();

        if (this.forwardCheck(variable, value, assignment, inferences)) {
          this.steps.push(`Assigned word '${value}' to variable '${varId}'`);

          const result = this.backtrack(assignment);
          if (result !== null) {
            return result;
          }
        }
      }

      this.steps.push(
        `Backtracking on variable '${varId}', removing word '${value}'`
      );

      assignment.delete(varId);
    }

    return null;
  }

  private forwardCheck(
    variable: CrosswordVariable,
    value: string,
    assignment: Map<string, string>,
    inferences: Map<string, Set<string>>
  ): boolean {
    const varId = variable.id;

    for (const neighbor of this.crossword.neighbors(variable)) {
      const neighborId = neighbor.id;

      if (!assignment.has(neighborId)) {
        const neighborDomain = this.domains.get(neighborId)!;
        const overlap = this.crossword.overlaps.get(`${varId}-${neighborId}`);

        if (overlap) {
          const [i, j] = overlap;
          const toRemove = new Set<string>();

          for (const neighborValue of neighborDomain) {
            if (value[i] !== neighborValue[j]) {
              toRemove.add(neighborValue);
            }
          }

          if (toRemove.size > 0) {
            if (!inferences.has(neighborId)) {
              inferences.set(neighborId, new Set());
            }

            for (const val of toRemove) {
              neighborDomain.delete(val);
              inferences.get(neighborId)!.add(val);
            }

            if (neighborDomain.size === 0) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  private assignmentComplete(assignment: Map<string, string>): boolean {
    return assignment.size === this.crossword.variables.size;
  }

  private consistent(
    variable: CrosswordVariable,
    assignment: Map<string, string>
  ): boolean {
    const value = assignment.get(variable.id)!;

    // Verifica se o comprimento corresponde
    if (value.length !== variable.length) {
      return false;
    }

    // Verifica se o valor já foi atribuído a outra variável
    for (const [varId, assignedValue] of assignment.entries()) {
      if (varId !== variable.id && assignedValue === value) {
        return false;
      }
    }

    // Verifica consistência com vizinhos atribuídos
    for (const neighbor of this.crossword.neighbors(variable)) {
      const neighborValue = assignment.get(neighbor.id);
      if (neighborValue) {
        const overlap = this.crossword.overlaps.get(
          `${variable.id}-${neighbor.id}`
        );
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
    const unassignedNeighbors = this.crossword
      .neighbors(variable)
      .filter((neighbor) => !assignment.has(neighbor.id));

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

    // Ordena os valores do menos restritivo para o mais restritivo
    return domainValues.sort(
      (a, b) => valueConstraints.get(a)! - valueConstraints.get(b)!
    );
  }

  private selectUnassignedVariable(
    assignment: Map<string, string>
  ): CrosswordVariable {
    const unassignedVariables = Array.from(this.crossword.variables).filter(
      (v) => !assignment.has(v.id)
    );

    // Ordena as variáveis usando MRV e Grau pré-calculado
    unassignedVariables.sort((a, b) => {
      const domainSizeA = this.domains.get(a.id)!.size;
      const domainSizeB = this.domains.get(b.id)!.size;

      if (domainSizeA !== domainSizeB) {
        return domainSizeA - domainSizeB;
      }

      const degreeA = this.variableDegrees.get(a.id)!;
      const degreeB = this.variableDegrees.get(b.id)!;

      return degreeB - degreeA;
    });

    return unassignedVariables[0];
  }
}
