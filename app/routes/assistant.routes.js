const express = require("express");
const router = express.Router();
const AssistantController = require("../controllers/assistant.controller");
const authenticate = require("../middlewares/auth.middlewares");

router.post(
  "/assistant_function_interact",
  authenticate,
  AssistantController.assistantFunctionInteract
);

module.exports = router;
