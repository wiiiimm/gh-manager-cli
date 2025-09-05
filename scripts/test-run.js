import { spawn } from 'child_process';

const proc = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

proc.stdout.on('data', (data) => {
  output += data.toString();
});

proc.stderr.on('data', (data) => {
  output += data.toString();
});

setTimeout(() => {
  proc.kill();
  const lines = output.split('\n');
  const lastLines = lines.slice(-50).join('\n');
  console.log(lastLines);
}, 3000);