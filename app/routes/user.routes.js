const express = require("express");
const userController = require("../controllers/user.controller");
const authenticate = require("../middlewares/auth.middlewares");

const router = express.Router();

router.get("/users/:id", userController.getUserById);
router.get("/users", userController.getAllUsers);
router.put("/users/:id", authenticate, userController.updateUser);
router.delete("/users/:id", userController.deleteUser);
router.post("/users", userController.initiateUserCreation);
router.post("/create-user", userController.verifyUserCreation);
router.post(
  "/github/exchange-code",
  authenticate,
  userController.updateGithubToken
);
router.get(
  "/github/validate-github-token",
  authenticate,
  userController.validateGithubToken
);
router.get(
  "/github/repositories",
  authenticate,
  userController.getGithubRepositories
);

router.post(
  "/gitlab/exchange-code",
  authenticate,
  userController.updateGitlabToken
);
router.get(
  "/gitlab/validate-gitlab-token",
  authenticate,
  userController.validateGitlabToken
);
router.get(
  "/gitlab/repositories",
  authenticate,
  userController.getGitlabRepositories
);

router.get(
  "/azure/validate-pat",
  authenticate,
  userController.validateAzureDevOpsToken
);
router.post("/azure/pat", authenticate, userController.updateAzureDevOpsToken);
router.get(
  "/azure/projects",
  authenticate,
  userController.getAzureDevOpsProjects
);
router.get(
  "/azure/repositories",
  authenticate,
  userController.getAzureDevOpsRepositories
);
router.get(
  "/azure/branches",
  authenticate,
  userController.getAzureDevOpsBranches
);
router.get("/", userController.healthCheck);

module.exports = router;
