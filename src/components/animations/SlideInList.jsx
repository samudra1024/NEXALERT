import React from 'react';
import { FlatList } from 'react-native';
import Animated, {
    FadeInDown,
    Layout
} from 'react-native-reanimated';

const SlideInList = ({ data, renderItem, ...props }) => {
    const renderAnimatedItem = ({ item, index }) => {
        return (
            <Animated.View
                entering={FadeInDown.delay(index * 50).duration(600).springify()}
                layout={Layout.springify()}
            >
                {renderItem({ item, index })}
            </Animated.View>
        );
    };

    return (
        <FlatList
            data={data}
            renderItem={renderAnimatedItem}
            {...props}
        />
    );
};

export default SlideInList;
