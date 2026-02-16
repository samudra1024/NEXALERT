import express from 'express'
import chalk from 'chalk'
import dotenv from 'dotenv'
import UserRouter from './routers/UserRouter.js'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { socketHandler } from './controller/socketHandler.js'

//Intialize the express application
const app = express()
const httpServer = createServer(app);

dotenv.config()
//Section for environment variable
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json())
app.use('/api', UserRouter)

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for mobile dev
        methods: ["GET", "POST"]
    }
});

socketHandler(io);

// Using httpServer.listen instead of app.listen
httpServer.listen(port, () => {
    console.log(chalk.green.underline.bold(`Server is running on port ${port}`))
})