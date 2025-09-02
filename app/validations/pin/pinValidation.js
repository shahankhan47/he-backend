const { object, string } = require("yup");

const createValidationSchema = object().shape({
  email: string().email("Invalid email format").required("Email is required"),
  // project_id: string().required("Project ID is required"),
  // topic_name: string().required("Topic name is required"),
  // pin_content: string()
  //   .required("Pin content is required")
  //   .min(1, "Pin content must be at least 1 character long")
  //   .max(1000, "Pin content cannot exceed 1000 characters"),
  // pin_id: string().required("Pin ID is required"),
});

module.exports = {
  createValidationSchema,
};
