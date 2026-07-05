import { Command } from 'commander';
import { runCmd } from './commands/run';
import { addClientCmd } from './commands/add-client';
import { addUserCmd } from './commands/add-user';
import { loggerOptions } from './commands/shared';
import { log, type LogLevelName } from './logger';

const program = new Command()
    .name('openid-tls-connector')
    .description('OIDC provider which uses client certificates for authentication')
    .version('1.0.0');

loggerOptions().forEach((o) => program.addOption(o));

program.hook('preAction', (_thisCommand, actionCommand) => {
    const { logLevel } = actionCommand.optsWithGlobals<{ logLevel: LogLevelName }>();
    log.setLevel(logLevel);
});

program.addCommand(runCmd);
program.addCommand(addClientCmd);
program.addCommand(addUserCmd);

program.parse(Bun.argv);
