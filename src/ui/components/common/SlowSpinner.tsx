import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

interface SlowSpinnerProps {
  interval?: number; // Interval in milliseconds
}

export const slowSpinnerFrames = ['.  ', '.. ', '...'] as const;

export default function SlowSpinner({ interval = 500 }: SlowSpinnerProps = {}) {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % slowSpinnerFrames.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [interval]);
  
  return <Text>{slowSpinnerFrames[frame]}</Text>;
}
