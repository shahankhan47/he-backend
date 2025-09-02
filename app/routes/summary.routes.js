const express = require("express");
const router = express.Router();
const summaryController = require("../controllers/summary.controller");
const authenticate = require("../middlewares/auth.middlewares");

router.get("/", authenticate, summaryController.getAllSummary);

module.exports = router;
