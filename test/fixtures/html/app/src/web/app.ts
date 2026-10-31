interface Greeting {
  text: string;
}
const greeting: Greeting = { text: 'hello' };
function show(g: Greeting): string {
  return g.text;
}
(window as unknown as { show: typeof show }).show = show;
