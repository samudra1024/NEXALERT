@echo off
echo Installing AsyncStorage dependency...
npm install

echo Cleaning build...
cd android
./gradlew clean
cd ..

echo Rebuilding app...
npx react-native run-android

echo Setup complete!