import React from 'react';
import { Platform, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | StyleProp<ViewStyle>[] | any;
  scaleTo?: number;
  children: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// react-native-web 0.21's Pressable does not implement hitSlop at all — the
// prop only exists on the legacy Touchable mixin, which Pressable does not
// use, so it falls into ...rest and is dropped as an invalid DOM prop. Everlit
// ships to web, so every hitSlop in this codebase was silently doing nothing
// and each control's hit area was exactly its styled box (the grid toggle,
// for one, was 22x22 against a 44x44 guideline).
//
// The fix is a transparent expander child rather than padding: padding would
// grow anything with a visible background or border (the glass circles), and
// negative margin to compensate would then fight the surrounding layout. An
// absolutely-positioned child with negative insets extends the pressable
// region without touching a single pixel of the visual.
//
// Native keeps the real prop, where it works properly.
// The floor we expand toward. Anything already this big needs no help, and
// expanding it anyway only steals presses from its neighbours: the deck's
// 80x80 nav arrows sit close enough to the 50x50 control circles that
// honouring their authored slop overlapped both hit areas.
const MIN_TAP = 44;

export default function PressableScale({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  onLayout,
  children,
  hitSlop,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Only the numeric form is polyfilled; nothing in this codebase uses the
  // per-edge object form, and silently half-supporting it would be worse.
  const wantsSlop = Platform.OS === 'web' && typeof hitSlop === 'number' && hitSlop > 0;

  // Expand toward MIN_TAP, never past it, and never further than the author
  // asked for. A control already >= 44 on an axis gets nothing on that axis.
  let padX = 0;
  let padY = 0;
  if (wantsSlop && box) {
    padX = Math.min(hitSlop as number, Math.max(0, (MIN_TAP - box.w) / 2));
    padY = Math.min(hitSlop as number, Math.max(0, (MIN_TAP - box.h) / 2));
  }

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      hitSlop={hitSlop}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) =>
          prev && prev.w === width && prev.h === height ? prev : { w: width, h: height },
        );
        onLayout?.(e);
      }}
      onPressIn={(e) => {
        scale.value = withTiming(reduceMotion ? 1 : scaleTo, { duration: 100 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 150 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {padX > 0 || padY > 0 ? (
        // Deliberately hit-testable (no pointerEvents="none"): the whole point
        // is that a press landing out here bubbles to the Pressable owning it.
        <View
          style={{ position: 'absolute', top: -padY, bottom: -padY, left: -padX, right: -padX }}
        />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}
