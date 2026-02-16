import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const slides = [
  {
    image: require('../assets/images/img1.png'),
    title: 'Your Shield Against SMS Scams!',
  },
  {
    image: require('../assets/images/img2.png'),
    title: 'Smart Contact – Simplify & Connect!',
  },
  {
    image: require('../assets/images/img3.png'),
    title: 'Precision Filtering with Smart Analysis!',
  },
];

const Onboarding = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  // Animated values for fade transition
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLastStep = currentStep === slides.length - 1;

  const animateToStep = (nextStep) => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (isLastStep) {
      navigation.navigate('AuthScreen');
    } else {
      animateToStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    navigation.navigate('AuthScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button – hidden on last step */}
      <View style={styles.header}>
        {!isLastStep ? (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      {/* Animated content area */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Image
          source={slides[currentStep].image}
          style={styles.image}
        />
        <Text style={styles.title}>{slides[currentStep].title}</Text>

        {/* Pagination dots */}
        <View style={styles.paginationContainer}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (index !== currentStep) {
                  animateToStep(index);
                }
              }}
            >
              <View
                style={[
                  styles.dot,
                  index === currentStep
                    ? [styles.activeDot, { backgroundColor: theme.primary }]
                    : styles.inactiveDot,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Next / Get Started button */}
      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: theme.primary }]}
        onPress={handleNext}
      >
        <Text style={styles.nextButtonText}>
          {isLastStep ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 18,
    color: '#298cff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: width * 0.8,
  },
  image: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    tintColor: '#298cff',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#298cff',
    textAlign: 'center',
    marginBottom: 40,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 25,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#298cff',
  },
  inactiveDot: {
    backgroundColor: '#F5F5DC',
  },
  nextButton: {
    width: '80%',
    paddingVertical: 15,
    backgroundColor: '#298cff',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default Onboarding;
