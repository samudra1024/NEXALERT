import express from 'express';
import {
  OPTSender,
  TestController,
  VERIFYOPT,
  resendOtpHandler,
  refreshTokenHandler,
} from '../controller/Usercontroller.js';

const UserRouter = express.Router();

UserRouter.get('/test', TestController);
UserRouter.post('/send-otp', OPTSender);
UserRouter.post('/resend-otp', resendOtpHandler);
UserRouter.post('/verify-otp', VERIFYOPT);
UserRouter.post('/refresh-token', refreshTokenHandler);

export default UserRouter;
