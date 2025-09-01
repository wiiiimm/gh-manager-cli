import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

// Custom slow spinner that updates every 0.5 seconds
export default function SlowSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 500); // 0.5 seconds per frame
    
    return () => clearInterval(timer);
  }, [frames.length]);
  
  return <Text>{frames[frame]}</Text>;
}

