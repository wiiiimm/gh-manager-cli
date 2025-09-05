import { spawn } from 'child_process';

const proc = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, CI: 'true' } // Disable raw mode in CI
});

let output = '';

proc.stdout.on('data', (data) => {
  output += data.toString();
  // Show last few lines live
  const lines = output.split('\n');
  if (lines.length > 5) {
    process.stdout.write('\x1Bc'); // Clear screen
    console.log(lines.slice(-10).join('\n'));
  }
});

proc.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

setTimeout(() => {
  proc.kill();
  console.log('\n\nFinal output captured.');
  process.exit(0);
}, 5000);