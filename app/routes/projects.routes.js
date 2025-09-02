const express = require('express');
const projectsController = require('../controllers/projects.controller');
const multer = require('multer');
const authenticate = require('../middlewares/auth.middlewares');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const projectsRouter = express.Router();

projectsRouter.use(authenticate);

// Existing project routes
projectsRouter.post('/delete', projectsController.deleteProject);
projectsRouter.post('/summary', projectsController.getProjectSummary);
projectsRouter.post('/mermaid', projectsController.getProjectMermaidDiagram);
projectsRouter.get('/', projectsController.getAllProjects);
projectsRouter.post('/initialize', projectsController.initializeProject);
projectsRouter.post('/uploadcodebase', upload.single('file'), projectsController.uploadCodebase);
projectsRouter.post('/add-collaborator', projectsController.addCollaborator);
projectsRouter.post('/remove-collaborator', projectsController.deleteCollaborator);
projectsRouter.post('/get-collaborators', projectsController.getCollaborators);
projectsRouter.post('/get_executive_summary', projectsController.downloadReport);
projectsRouter.post('/sync', upload.single('file'), projectsController.updateCodebase);

module.exports = projectsRouter;
