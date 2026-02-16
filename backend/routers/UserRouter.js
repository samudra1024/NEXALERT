import express from 'express'
import { OPTSender, TestController, VERIFYOPT } from '../controller/Usercontroller.js'

const UserRouter = express.Router()

UserRouter.get('/test', TestController)
UserRouter.post('/send-otp', OPTSender) // Endpoint to send OTP
UserRouter.post('/verify-otp', VERIFYOPT) // Endpoint to verify OTP

export default UserRouter