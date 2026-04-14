import { useEffect, useRef } from "react";
import { Animated, Easing, Text } from "react-native";

type FloatToastProps = {
  xp: number;
  message: string;
  onHide: () => void;
  anchorTop?: number; // px from top of container; if omitted, centers vertically
};

export function FloatToast({ xp, message, onHide, anchorTop }: FloatToastProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -40,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: anchorTop !== undefined ? anchorTop : 0,
        bottom: anchorTop !== undefined ? undefined : 0,
        left: 0,
        right: 0,
        alignItems: "center",
        justifyContent: anchorTop !== undefined ? "flex-start" : "center",
        opacity,
        transform: [{ translateY }],
        zIndex: 20,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "800",
          color: "#18181b",
          textAlign: "center",
          lineHeight: 22,
        }}
      >
        {message}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: "#f97316",
          textAlign: "center",
        }}
      >
        +{xp} XP
      </Text>
    </Animated.View>
  );
}
