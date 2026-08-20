import crypto from 'crypto';
import chalk from 'chalk';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

// In-memory session store (use Redis/DB in production)
const sessions = new Map();

const ACCESS_TOKEN_TTL_SEC = 86400; // 24 hours
const REFRESH_TOKEN_TTL_SEC = 604800; // 7 days

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizePhone(phoneNumber) {
  if (!phoneNumber) return null;
  if (phoneNumber.startsWith('+')) return phoneNumber;
  if (phoneNumber.length === 10) return `+91${phoneNumber}`;
  return phoneNumber;
}

function createSession(phoneNumber) {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const now = Date.now();

  sessions.set(accessToken, {
    phoneNumber,
    refreshToken,
    accessExpiresAt: now + ACCESS_TOKEN_TTL_SEC * 1000,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_SEC * 1000,
  });

  sessions.set(refreshToken, {
    phoneNumber,
    accessToken,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_SEC * 1000,
    type: 'refresh',
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}

function TestController(req, res) {
  console.log(chalk.red.underline.bold(`Request hit at ${req.method} /api/test`));
  return res.status(200).json({ message: 'NexAlert API is running' });
}

async function sendOtpHandler(req, res) {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber is required', success: false });
  }

  console.log(chalk.blue(`Sending OTP to: ${phoneNumber}`));

  // if (client && verifyServiceSid) {
  //   try {
  //     await client.verify.v2
  //       .services(verifyServiceSid)
  //       .verifications.create({ to: phoneNumber, channel: 'sms' });
  //     return res.status(200).json({ message: 'OTP sent', success: true });
  //   } catch (error) {
  //     console.error(chalk.red(`Twilio send error: ${error.message}`));
  //     return res.status(500).json({ error: 'Failed to send OTP. Please try again.', success: false });
  //   }
  // }

  // Dev/stub mode when Twilio is not configured
  return res.status(200).json({ message: 'OTP sent (dev mode)', success: true });
}

async function resendOtpHandler(req, res) {
  return sendOtpHandler(req, res);
}

async function verifyOtpHandler(req, res) {
  try {
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const { code } = req.body;

    // if (!phoneNumber || !code) {
    //   return res.status(400).json({ error: 'phoneNumber and code are required', success: false });
    // }

    // if (client && verifyServiceSid) {
    //   const verificationCheck = await client.verify.v2
    //     .services(verifyServiceSid)
    //     .verificationChecks.create({ to: phoneNumber, code });

    //   if (verificationCheck.status !== 'approved') {
    //     return res.status(400).json({ error: 'Invalid OTP', success: false });
    //   }
    // }

    const tokens = createSession(phoneNumber);
    return res.status(200).json({
      message: 'OTP verified successfully',
      success: true,
      ...tokens,
      phoneNumber,
    });
  } catch (error) {
    console.error(chalk.red(`Verify error: ${error.message}`));
    return res.status(500).json({ error: 'Verification failed. Please try again.', success: false });
  }
}

async function refreshTokenHandler(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required', success: false });
    }

    const session = sessions.get(refreshToken);
    if (!session || session.type !== 'refresh' || session.refreshExpiresAt < Date.now()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token', success: false });
    }

    // Invalidate old tokens
    if (session.accessToken) sessions.delete(session.accessToken);
    sessions.delete(refreshToken);

    const tokens = createSession(session.phoneNumber);
    return res.status(200).json({ success: true, ...tokens });
  } catch (error) {
    return res.status(500).json({ error: 'Token refresh failed', success: false });
  }
}

export { TestController, sendOtpHandler as OPTSender, verifyOtpHandler as VERIFYOPT, resendOtpHandler, refreshTokenHandler };
