class Greeter {
  static instances = 0;
  private readonly greeting: string;

  constructor(options: GreeterOptions = {}) {
    this.greeting = options.greeting ?? 'Hello';
    Greeter.instances += 1;
  }

  greet(name: string): string {
    Logger.log(`greeting ${name}`);
    return `${this.greeting}, ${name}`;
  }

  fail(): never {
    throw new Error('boom');
  }
}

const VERSION = '1.0.0';
