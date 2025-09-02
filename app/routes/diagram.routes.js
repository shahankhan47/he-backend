const express = require("express");
const router = express.Router();
const diagramController = require("../controllers/diagram.controller");
const authenticate = require("../middlewares/auth.middlewares");

router.get("/", authenticate, diagramController.getAllDiagram);

module.exports = router;
