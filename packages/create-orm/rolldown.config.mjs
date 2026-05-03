import {
  rolldownExportFile,
  rolldownExportShebang,
} from '../../rolldown.utils.mjs';
import packageJson from './package.json' with { type: 'json' };

/** @type {import('rolldown').RolldownOptions[]} */
export default [
  ...rolldownExportFile('src/lib', 'dist/lib', {
    forbidImportFrom: packageJson.name,
  }),
  rolldownExportShebang('src/bin', 'dist/bin'),
];
