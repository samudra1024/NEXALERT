import chalk from 'chalk'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

const client = twilio(accountSid, authToken);

// ✅ Test route
function TestController(req, res) {
    console.log(chalk.red.underline.bold(`Request hit at ${req.method} /api/test`));
    return res.status(200).json({
        message: 'This is the test controller'
    });
}

// Endpoint to send OTP
const OPTSender = async (req, res) => {

    console.log(accountSid, authToken, verifyServiceSid);


    const { phoneNumber } = req.body;
    console.log(chalk.blue(`Request to send OTP to: ${phoneNumber}`));
    return res.status(200).json({
        message: 'This is the OPTSender controller for testing',
        success: true
    })
    // if (!phoneNumber) {
    //     return res.status(400).json({ error: 'phoneNumber is required' });
    // }
    // try {
    //     const verification = await client.verify.v2
    //         .services(verifyServiceSid)
    //         .verifications
    //         .create({ to: phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`, channel: 'sms' });

    //     console.log(chalk.green(`OTP sent to ${phoneNumber}: ${verification.status}`));

    //     return res.status(200).json({ message: 'OTP sent', success: true });
    // } catch (error) {
    //     return res.status(500).json({ error: error.message });
    // }
};

const VERIFYOPT = async (req, res) => {
    try {
        let { phoneNumber, code } = req.body;
        if (!phoneNumber || !code) {
            return res.status(400).json({ error: 'phoneNumber and code are required' });
        }

        // Force E.164 format: Add +91 if length is 10 and doesn't start with '+'
        if (!phoneNumber.startsWith('+')) {
            // Example: for India
            if (phoneNumber.length === 10) {
                phoneNumber = '+91' + phoneNumber;
            } else {
                return res.status(400).json({ error: 'phoneNumber must be in E.164 format (e.g., +919876543210)' })
            }
        }
        return res.status(200).json({
            message: 'This is the VERIFYOPT controller for testing',
            success: true
        })

        // const verificationCheck = await client.verify.v2
        //     .services(verifyServiceSid)
        //     .verificationChecks.create({
        //         to: phoneNumber,
        //         code: code,
        //         channel: 'sms'
        //     })
        //     .then((result) => {
        //         console.log(chalk.green(`Verification check result: ${result.status}`));
        //         return result;
        //     })
        //     .catch((error) => {
        //         console.error(chalk.red(`Error during verification check: ${error.message}`));
        //         throw error;
        //     });

        // if (verificationCheck.status === 'approved') {
        //     res.status(200).json({ message: 'OTP verified successfully', success: true });
        // } else {
        //     res.status(400).json({ error: 'Invalid OTP' });
        // }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


export { TestController, OPTSender, VERIFYOPT };
