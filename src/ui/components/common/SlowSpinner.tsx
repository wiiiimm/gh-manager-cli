import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

// Custom slow spinner that updates every 0.5 seconds by default
interface SlowSpinnerProps {
  interval?: number; // Interval in milliseconds
}

export default function SlowSpinner({ interval = 500 }: SlowSpinnerProps = {}) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [frames.length, interval]);
  
  return <Text>{frames[frame]}</Text>;
}

