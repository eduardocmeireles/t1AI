import { Crossword } from './Crossword';
import { CrosswordCreator } from './CrosswordCreator';

function main(): void {
    const args = process.argv.slice(2);
    if (args.length < 2 || args.length > 3) {
        process.exit(1);
    }

    const structure = args[0];
    const words = args[1];
    const output = args[2] ? args[2] : 'output.txt';

    const crossword = new Crossword(structure, words);
    const creator = new CrosswordCreator(crossword);
    
    const assignment = creator.solve();

    if (assignment === null) {
        console.log("Não tem solução.");
    } else {
        console.log(`Sucesso! Solução salva no ${output}`);
        creator.save(assignment, output);
    }
}

main();
