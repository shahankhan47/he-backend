const { default: axios } = require('axios');
const { createValidationSchema } = require('../validations/pin/pinValidation');
const aiService = require('../utils/axiosInterceptor');

class PinController {
  async createPin(req, res) {
    const { project_id, email } = req.query;
    const { topic_name, pin_content } = req.body;
    try {
      const response = await aiService.post(`${process.env.PYTHON_URL}/create_pin?project_id=${project_id}&email=${email}`, {
        topic_name,
        pin_content,
      });

      if (response.status === 200) {
        res.status(200).json({ message: 'Pin created successfully' });
      } else {
        console.error('Error response from Python backend:', response.data);
        res.status(response.status).json({
          message: 'Error creating pin',
          response: response.data,
        });
      }
    } catch (error) {
      console.error('Error in createPin:', error.message);
      if (error.name === 'ValidationError') {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({
          message: 'An error occurred while creating the pin',
          error: error.message,
        });
      }
    }
  }

  async getAllPin(req, res) {
    const { project_id } = req.query;
    const email = req.user?.email;

    try {
      createValidationSchema.validateSync({ email, project_id }, { abortEarly: false });

      const response = await aiService.get(`${process.env.PYTHON_URL}/fetch_pins_by_project`, {
        params: { project_id, email },
      });

      res.status(201).json(response?.data?.pins || []);
    } catch (error) {
      console.error('Error occurred:', error?.response?.data?.detail || error.message);

      if (error?.response?.data?.detail === '404: No pins found for this project.') {
        return res.status(201).json({
          message: 'No pinned topics here',
          pins: [],
        });
      }

      if (error?.response) {
        console.error('Python backend responded with an error:', error.response.data);
        return res.status(error.response.status).json({
          error: error.response.data || 'Error fetching pins',
        });
      }

      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async deletePin(req, res) {
    // Debug the entire request body and params
    console.log('Request body:', req.body);
    console.log('Request params:', req.params);
    console.log('Request query:', req.query);

    // Try to get pin_id from all possible locations
    const pin_id = req.body.pin_id || req.params.pin_id || req.query.pin_id;
    const email = req.user.email;

    try {
      console.log('Attempting to delete pin with extracted values:', {
        pin_id,
        email,
      });

      createValidationSchema.validateSync({ email, pin_id }, { abortEarly: false });

      console.log('Validation passed, making request to Python backend');

      const response = await aiService.delete(`${process.env.PYTHON_URL}/delete_pin`, {
        params: { pin_id, email },
      });

      console.log('Python backend response:', response.status, response.data);

      if (response.status === 200) {
        res.status(200).json({ message: 'Pin deleted successfully' });
      } else {
        console.error('Unexpected response status:', response.status);
        res.status(response.status).json({
          message: 'Error deleting pin',
          response: response.data,
        });
      }
    } catch (error) {
      console.error('Delete pin error details:', {
        name: error.name,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        pin_id: pin_id,
      });

      if (error.name === 'ValidationError') {
        res.status(400).json({ error: error.errors });
      } else if (error.response) {
        res.status(error.response.status || 500).json({
          message: 'Error from Python backend',
          error: error.response.data,
        });
      } else {
        console.error('Error communicating with Python backend:', error.message);
        res.status(500).json({
          message: 'An error occurred while deleting the pin',
          error: error.message,
        });
      }
    }
  }
}

module.exports = new PinController();
