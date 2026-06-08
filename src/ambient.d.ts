// clipboardy is an optional runtime dependency (not always installed).
// The dynamic import is wrapped in try/catch in copyToClipboard; this
// ambient declaration keeps tsc happy without affecting the build.
declare module 'clipboardy' {
  export function write(text: string): Promise<void>;
  export function read(): Promise<string>;
}
