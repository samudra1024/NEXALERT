import React, { forwardRef, useMemo } from 'react';
import { FlatList } from 'react-native';

/**
 * Performance-tuned FlatList wrapper.
 * Used instead of FlashList v2, which requires React Native New Architecture.
 */
const OptimizedList = forwardRef(function OptimizedList(
  { estimatedItemSize, useFixedItemLayout = false, ...props },
  ref,
) {
  const getItemLayout = useMemo(() => {
    if (props.getItemLayout) return props.getItemLayout;
    if (!useFixedItemLayout || !estimatedItemSize) return undefined;
    return (_, index) => ({
      length: estimatedItemSize,
      offset: estimatedItemSize * index,
      index,
    });
  }, [props.getItemLayout, useFixedItemLayout, estimatedItemSize]);

  return (
    <FlatList
      ref={ref}
      {...props}
      getItemLayout={getItemLayout}
      removeClippedSubviews={props.removeClippedSubviews ?? true}
      maxToRenderPerBatch={props.maxToRenderPerBatch ?? 12}
      windowSize={props.windowSize ?? 8}
      initialNumToRender={props.initialNumToRender ?? 12}
      updateCellsBatchingPeriod={props.updateCellsBatchingPeriod ?? 100}
    />
  );
});

export default OptimizedList;
