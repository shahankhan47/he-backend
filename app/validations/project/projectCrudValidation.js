const { object, string } = require("yup");

const deleteProjectValidationSchema = object().shape({
  projectId: string().required(),
  email: string().email().required(),
});

const initializeProjectValidationSchema = object().shape({
  projectName: string().required(),
  description: string().required(),
});

module.exports = {
  deleteProjectValidationSchema,
  initializeProjectValidationSchema,
};
