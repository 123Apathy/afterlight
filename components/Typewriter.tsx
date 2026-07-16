import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

type TypewriterProps = TextProps & {
  text: string;
  delay?: number;
  speed?: number;
  active?: boolean;
};

export default function Typewriter({
  text,
  delay = 0,
  speed = 28,
  active = true,
  style,
  ...rest
}: TypewriterProps) {
  const reduceMotion = useReducedMotion();
  const skipAnimation = !active || reduceMotion;
  const [count, setCount] = useState(skipAnimation ? text.length : 0);

  useEffect(() => {
    if (skipAnimation) {
      setCount(text.length);
      return;
    }

    setCount(0);
    let charIndex = 0;
    let interval: ReturnType<typeof setInterval>;

    const startTimeout = setTimeout(() => {
      interval = setInterval(() => {
        charIndex += 1;
        setCount(charIndex);
        if (charIndex >= text.length) {
          clearInterval(interval);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      clearInterval(interval);
    };
  }, [text, delay, speed, skipAnimation]);

  return (
    <Text style={style} {...rest}>
      {text.slice(0, count)}
    </Text>
  );
}
