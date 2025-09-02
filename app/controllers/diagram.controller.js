const { default: axios } = require('axios');
const { createValidationSchema } = require('../validations/pin/pinValidation');
const aiService = require('../utils/axiosInterceptor');

class DiagramController {
  async getAllDiagram(req, res) {
    const { project_id } = req.query;
    const email = req.user.email;

    try {
      // Validate the input data
      createValidationSchema.validateSync({ email, project_id }, { abortEarly: false });

      // Make a request to the Python backend
      const response = await aiService.get(`${process.env.PYTHON_URL}/project_diagrams`, {
        params: {
          project_id,
          email,
        },
      });

      // console.log("Response from Python backend:", response.data);

      res.status(201).json(response.data);
    } catch (error) {
      console.error('Error occurred:', error.response?.data?.detail);

      // Handle other errors from the Python backend
      if (error.response) {
        console.error('Python backend responded with an error:', error.response.data);
        return res.status(error.response.status).json({
          error: error.response.data?.detail || 'Error fetching pins',
        });
      }

      // Handle general server errors
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new DiagramController();
