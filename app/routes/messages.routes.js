const express = require('express');
const messagesController = require('../controllers/messages.controller');
const authenticate = require('../middlewares/auth.middlewares');

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const messagesRouter = express.Router();

messagesRouter.use(authenticate);

messagesRouter.post('/upload-file', upload.single('file'), messagesController.uploadFile);
messagesRouter.get('/', messagesController.getAllMessages);
messagesRouter.post('/', messagesController.postMessage);

module.exports = messagesRouter;
