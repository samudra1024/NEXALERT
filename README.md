# NexAlert

NexAlert is a React Native SMS client with ML-powered spam detection, secure OTP authentication, and a modern messaging experience.

## Features

- SMS inbox with category tabs (Personal, Banking, OTP, etc.)
- Contact name resolution from device contacts
- Persistent login with token refresh
- Swipe to archive/delete conversations
- Default SMS app support (Android)
- Dark mode

## New Dependencies

```bash
npm install zustand
```

Removed deprecated `AsyncStorage` stub package — use `@react-native-async-storage/async-storage` only.

## Setup

### Mobile App

```bash
npm install
npm start
npm run android   # or npm run ios
```

Update `src/config/API.js` with your backend URL before testing OTP auth.

### Backend

```bash
cd backend
npm install
npm start
```

Optional Twilio env vars for real OTP:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

Without Twilio, the backend runs in dev stub mode (any OTP accepted).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/send-otp` | Send OTP |
| POST | `/api/resend-otp` | Resend OTP |
| POST | `/api/verify-otp` | Verify OTP, returns tokens |
| POST | `/api/refresh-token` | Refresh access token |

## App Identity

- Display name: **NexAlert**
- Android application ID: `com.nexalert`
- Registered component name: `NexAlert`

## Testing

```bash
npm test
```

## Manual Testing Checklist

- [ ] App shows NexAlert name and icon on home screen
- [ ] Login persists after app restart
- [ ] Contacts show names instead of raw numbers
- [ ] Message list scrolls smoothly with 100+ messages
- [ ] Swipe left deletes, swipe right archives
- [ ] OTP digits visible with Show/Hide toggle
- [ ] Skip button on all onboarding screens
- [ ] Default SMS app sets on first attempt
- [ ] Profile shows authenticated phone number
