import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint({
  web: { files: ['src/web/**/*.ts'], tsconfig: './tsconfig.frontend.json' },
});
