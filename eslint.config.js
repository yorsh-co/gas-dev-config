import { gasEslint } from './eslint/index.js';

export default gasEslint({ preset: 'node', ignores: ['test/fixtures/**'] });
