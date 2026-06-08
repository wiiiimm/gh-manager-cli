// clipboardy is an optional runtime dependency (not always installed).
// The dynamic import is wrapped in try/catch in copyToClipboard; this
// ambient declaration keeps tsc happy without affecting the build.
declare module 'clipboardy' {
  export function write(text: string): Promise<void>;
  export function read(): Promise<string>;
  // clipboardy ships as an ESM default export as well as named exports;
  // declaring both lets `(clipboardy.default ?? clipboardy).write(...)` type-check.
  const clipboardy: {
    write(text: string): Promise<void>;
    read(): Promise<string>;
  };
  export default clipboardy;
}
