import React from 'react';
import { FlatList } from 'react-native';

// Performance-optimized list wrapper.
// Previously, every item had a stacked FadeInDown animation with
// delay(index * 50) which caused massive lag with 100+ items.
// Now we use a plain FlatList with proper optimization props.
const SlideInList = ({ data, renderItem, ...props }) => {
    return (
        <FlatList
            data={data}
            renderItem={renderItem}
            removeClippedSubviews={true}
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={15}
            updateCellsBatchingPeriod={50}
            {...props}
        />
    );
};

export default React.memo(SlideInList);
