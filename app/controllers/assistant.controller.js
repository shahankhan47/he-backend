const { default: axios } = require('axios');
const aiService = require('../utils/axiosInterceptor');

// Store checklists by project ID
const checklistStorage = {};

class AssistantController {
  async assistantFunctionInteract(req, res) {
    const { project_id, assistant_action, content } = req.query;

    try {
      const response = await aiService.post(
        `${process.env.PYTHON_URL}/assistant_function_interact`,
        {},
        {
          params: {
            project_id,
            assistant_action,
            content: content,
            email: req.user.email,
          },
        }
      );
      console.log('Response:', response.data);
      return res.status(200).json(response.data);
    } catch (error) {
      console.error('Backend - Error:', error);
      res.status(400).json({
        error: error.message || 'Error in assistant function interaction',
      });
    }
  }
}

module.exports = new AssistantController();
