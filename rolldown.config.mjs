import { rolldownExportFile } from './rolldown.utils.mjs';

/** @type {import('rolldown').RolldownOptions[]} */
export default rolldownExportFile('src/index', 'dist/index');
