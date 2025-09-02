const express = require("express");
const router = express.Router();
const pinController = require("../controllers/pin.controller");
const authenticate = require("../middlewares/auth.middlewares");

router.get("/", authenticate, pinController.getAllPin);
router.delete("/:id", authenticate, pinController.deletePin);
router.post("/", authenticate, pinController.createPin);

module.exports = router;
