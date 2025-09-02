const aiService = require('../utils/axiosInterceptor');
const FormData = require('form-data');
class MessagesController {
  async getAllMessages(req, res) {
    const email = req.user.email;
    const projectId = req.query.projectId;
    try {
      const response = await aiService.get(`${process.env.PYTHON_URL}/conversation-history?email=${email}&project_id=${projectId}`);
      console.log('\n\n', response?.data?.history);
      res.status(200).json(response?.data?.history);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async postMessage(req, res) {
    const { userQuestion, checklistAssistant } = req.body ?? {};
    const email = req.user.email;
    const projectId = req.body.projectId;
    try {
      const input = new FormData();
      input.append('user_question', userQuestion);
      input.append('project_id', projectId);
      input.append('email', email);
      input.append('checklistAssistant', checklistAssistant === true ? true : false);
      const response = await aiService
        .post(`${process.env.PYTHON_URL}/chat-pro`, input, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        .catch((error) => console.log(error));
      res.status(200).json(response?.data);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async uploadFile(req, res) {
    const projectId = req.body.projectId;
    const file = req.file;

    // Validate required fields
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    console.info({ file });
    try {
      const input = new FormData();

      // Append file with proper metadata
      input.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await aiService.post(`${process.env.PYTHON_URL}/upload_file?project_id=${projectId}`, input, {
        headers: {
          ...input.getHeaders(),
        },
      });
      res.status(200).json(response?.data);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new MessagesController();
