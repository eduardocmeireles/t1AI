const { Crossword } = require('./Crossword');
const { CrosswordCreator } = require('./CrosswordCreator');
const fs = require('fs');

function main(): void {
    const args = process.argv.slice(2);
    if (args.length < 2 || args.length > 3) {
        console.error("Usage: ts-node Program.ts structure.txt words.txt [output.txt]");
        process.exit(1);
    }

    const structure = args[0];
    const words = args[1];
    const output = args[2] ? args[2] : 'output.txt';

    // Generate the crossword puzzle
    const crossword = new Crossword(structure, words);
    const creator = new CrosswordCreator(crossword);
    
    const assignment = creator.solve();

    // Display the result and save to file
    if (assignment === null) {
        console.log("No solution.");
    } else {
        console.log(`Solution found. Saving to ${output}`);
        creator.save(assignment, output);
    }
}

main();
