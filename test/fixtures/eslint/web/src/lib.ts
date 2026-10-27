class Greeter {
  greet(name: string): string {
    return `Hello ${name}`;
  }
}

const unused = 1;

function run(): void {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(new Greeter().greet(sheet.getName()));
}
