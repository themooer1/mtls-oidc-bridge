import { Command } from 'commander';
import { runCmd } from './commands/run';
import { addClientCmd } from './commands/add-client';

const program = new Command()
    .name('openid-tls-connector')
    .description('OIDC provider which uses client certificates for authentication')
    .version('1.0.0');

program.addCommand(runCmd);
program.addCommand(addClientCmd);

program.parse(Bun.argv);