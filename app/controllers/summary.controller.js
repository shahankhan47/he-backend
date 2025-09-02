const { createValidationSchema } = require('../validations/pin/pinValidation');
const axios = require('../utils/axiosInterceptor');

class SummaryController {
  async getAllSummary(req, res) {
    const { project_id } = req.query;
    const email = req.user.email;

    try {
      console.log('Payload being sent:', { project_id, email });

      // Validate the input data
      createValidationSchema.validateSync({ email, project_id }, { abortEarly: false });

      // Make a request to the Python backend
      const response = await axios.get(`${process.env.PYTHON_URL}/executive-summary`, {
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

module.exports = new SummaryController();
