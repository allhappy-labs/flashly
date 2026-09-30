import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    StyleSheet,
    type ListRenderItem,
    type StyleProp,
    type ViewStyle,
    View,
} from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';

type Props<T> = Readonly<{
    items: readonly T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (item: T, index: number) => React.ReactElement;
    backgroundColor: string;
    containerStyle?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    fadeWidth?: number;
    height?: number;
}>;

export default function ScrollableChips<T>(props: Props<T>) {
    const fadeWidth = props.fadeWidth ?? 24;
    const [viewportWidth, setViewportWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const [scrollX, setScrollX] = useState(0);
    const leftFadeOpacity = useRef(new Animated.Value(0)).current;
    const rightFadeOpacity = useRef(new Animated.Value(0)).current;

    const isScrollable = contentWidth > viewportWidth + 1;
    const showLeftFade = isScrollable && scrollX > 2;
    const showRightFade = isScrollable && scrollX < contentWidth - viewportWidth - 2;
    const transparentBackground = useMemo(
        () => toTransparentColor(props.backgroundColor),
        [props.backgroundColor]
    );
    const fadeHeight = (props.height ?? contentHeight) || viewportHeight;
    const fadeTop = Math.max(0, (viewportHeight - fadeHeight) / 2);

    useEffect(() => {
        Animated.timing(leftFadeOpacity, {
            toValue: showLeftFade ? 1 : 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [leftFadeOpacity, showLeftFade]);

    useEffect(() => {
        Animated.timing(rightFadeOpacity, {
            toValue: showRightFade ? 1 : 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [rightFadeOpacity, showRightFade]);

    const listRenderItem = useMemo<ListRenderItem<T>>(
        () => ({ item, index }) => props.renderItem(item, index),
        [props]
    );

    return (
        <View
            style={[styles.container, props.containerStyle]}
            onLayout={(event) => {
                setViewportWidth(event.nativeEvent.layout.width);
                setViewportHeight(event.nativeEvent.layout.height);
            }}
        >
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={props.items as T[]}
                renderItem={listRenderItem}
                keyExtractor={props.keyExtractor}
                contentContainerStyle={props.contentContainerStyle}
                onContentSizeChange={(width, height) => {
                    setContentWidth(width);
                    setContentHeight(height);
                }}
                onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
                scrollEventThrottle={16}
            />

            <Animated.View
                pointerEvents="none"
                style={[styles.fade, { left: 0, top: fadeTop, width: fadeWidth, height: fadeHeight, opacity: leftFadeOpacity }]}
            >
                <Canvas style={{ width: fadeWidth, height: fadeHeight }}>
                    <Rect x={0} y={0} width={fadeWidth} height={fadeHeight}>
                        <LinearGradient
                            start={vec(0, 0)}
                            end={vec(fadeWidth, 0)}
                            colors={[props.backgroundColor, transparentBackground]}
                        />
                    </Rect>
                </Canvas>
            </Animated.View>

            <Animated.View
                pointerEvents="none"
                style={[styles.fade, { right: 0, top: fadeTop, width: fadeWidth, height: fadeHeight, opacity: rightFadeOpacity }]}
            >
                <Canvas style={{ width: fadeWidth, height: fadeHeight }}>
                    <Rect x={0} y={0} width={fadeWidth} height={fadeHeight}>
                        <LinearGradient
                            start={vec(0, 0)}
                            end={vec(fadeWidth, 0)}
                            colors={[transparentBackground, props.backgroundColor]}
                        />
                    </Rect>
                </Canvas>
            </Animated.View>
        </View>
    );
}

function toTransparentColor(color: string): string {
    if (color.startsWith('#') && color.length === 7) {
        return `${color}00`;
    }
    if (color.startsWith('rgba(')) {
        return color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[^)]+\)/, 'rgba($1, $2, $3, 0)');
    }
    if (color.startsWith('rgb(')) {
        return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, 'rgba($1, $2, $3, 0)');
    }
    return 'transparent';
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    fade: {
        position: 'absolute',
    },
});
