test('greets', ({ prefix, spreadsheet }) => {
  const sheet = spreadsheet.insertSheet(`${prefix}greet`);
  assert(greet('Ann') === 'Hello, Ann', 'unexpected greeting');
  assert(sheet.getName().startsWith(prefix));
});

info('spreadsheet locale', ({ spreadsheet }) => spreadsheet.getSpreadsheetLocale());

function run(): string {
  return runGasTests('id');
}
