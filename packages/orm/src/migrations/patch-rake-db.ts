import { rakeDbCommands } from 'rake-db';
import { generate } from './generate/generate';
import { pull } from './pull/pull';

let patched = false;
export const patchRakeDb = () => {
  if (patched) {
    return;
  }

  patched = true;

  rakeDbCommands.g = rakeDbCommands.generate = {
    run: generate,
    help: 'gen migration from OrchidORM tables',
    helpArguments: {
      'no arguments': '"generated" is a default file name',
      'migration-name': 'set migration file name',
      up: 'auto-apply migration',
      'migration-name up': 'with a custom name and apply it',
    },
    helpAfter: 'reset',
  };

  rakeDbCommands.pull.run = pull;
  rakeDbCommands.pull.help =
    'generate ORM tables and a migration for an existing database';
};
