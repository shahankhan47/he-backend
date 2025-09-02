const {
  deleteProjectValidationSchema,
} = require("../validations/project/projectCrudValidation");
const FormData = require("form-data");
const User = require("../models/user.model");
const { Buffer } = require("buffer");
const Project = require("../models/project.model");
const webhookService = require("../services/webhook.service");
const githubService = require("../services/github.service");
const gitlabService = require("../services/gitlab.service");
const { Op } = require("sequelize");
const axios = require("../utils/axiosInterceptor");
const azureDevopsService = require("../services/azure-devops.service");
const fs = require("fs");
const path = require("path");

class ProjectsController {
  constructor() {
    // Bind methods to the instance
    this.uploadCodebase = this.uploadCodebase.bind(this);
    this.updateCodebase = this.updateCodebase.bind(this);
    this.handleCodebaseOperation = this.handleCodebaseOperation.bind(this);
    this.handleGithubUpload = this.handleGithubUpload.bind(this);
    this.handleGitlabUpload = this.handleGitlabUpload.bind(this);
    this.handleAzureUpload = this.handleAzureUpload.bind(this);
    this.handleManualUpload = this.handleManualUpload.bind(this);
    this.sendToPythonAPI = this.sendToPythonAPI.bind(this);
  }

  async initializeProject(req, res) {
    const owner_email = req.user?.email;
    const { project_name, project_description, collaborators } = req.body;
    try {
      const processedPayload = Array.isArray(collaborators)
        ? collaborators.reduce((acc, collaborator) => {
            acc[collaborator.email] = collaborator.role;
            return acc;
          }, {})
        : {};

      const response = await axios.post(
        `${process.env.PYTHON_URL}/initialize_project`,
        processedPayload,
        {
          params: {
            owner_email,
            project_name,
            project_description,
          },
        }
      );

      await Project.create({
        id: response.data.project_id,
        createdBy: req.user.id,
        projectName: project_name,
      });

      return res.status(200).json({
        message: "Project initialized successfully",
        project_id: response.data.project_id,
      });
    } catch (error) {
      return res
        .status(400)
        .json({ error: error.response?.data || error.message });
    }
  }

  async uploadCodebase(req, res) {
    return this.handleCodebaseOperation(req, res, "addcodebase");
  }

  async updateCodebase(req, res) {
    return this.handleCodebaseOperation(req, res, "updatecodebase");
  }

  async handleCodebaseOperation(req, res, endpoint) {
    try {
      const {
        project_id,
        repositoryUrl,
        azure_project_id,
        isPrivateRepository: isPrivate,
        branch,
        source = "github",
      } = req.body;
      const isPrivateRepository = isPrivate === "true" ? true : false;
      const file = req.file;

      if (!project_id || !(file || repositoryUrl)) {
        return res
          .status(400)
          .json({ error: "Project ID and (file or repository) are required" });
      }

      const formData = new FormData();
      formData.append("project_id", project_id);

      if (repositoryUrl) {
        if (source === "azure") {
          await this.handleAzureUpload(req, formData, {
            repositoryId: repositoryUrl,
            branch,
            projectId: azure_project_id,
          });
        } else if (source === "gitlab") {
          await this.handleGitlabUpload(req, formData, {
            repositoryUrl,
            isPrivateRepository,
            branch,
            projectId: project_id,
          });
        } else {
          await this.handleGithubUpload(req, formData, {
            repositoryUrl,
            isPrivateRepository,
            branch,
            projectId: project_id,
          });
        }

        // Handle repository upload response
        const response = await this.sendToPythonAPI(
          req.user.email,
          project_id,
          formData,
          endpoint,
          source
        );

        return endpoint === "addcodebase"
          ? res.status(201).json({ message: "Codebase uploaded successfully" })
          : res.status(200).json({
              message: "Project synced successfully",
              details: response.data,
            });
      } else if (file) {
        // Validate file for manual upload
        if (!file.mimetype || !file.mimetype.includes("zip")) {
          return res.status(400).json({
            error: "Only ZIP files are supported for manual upload",
          });
        }

        // Check file size (150MB limit)
        const maxSize = 150 * 1024 * 1024; // 150MB in bytes
        if (file.size > maxSize) {
          return res.status(400).json({
            error: `File size exceeds 150MB limit. Current size: ${(
              file.size /
              (1024 * 1024)
            ).toFixed(2)}MB`,
          });
        }

        const pythonFormData = await this.handleManualUpload(formData, file);
        const uploadSource = "manual";

        const response = await this.sendToPythonAPI(
          req.user.email,
          project_id,
          pythonFormData,
          endpoint,
          uploadSource
        );

        return endpoint === "addcodebase"
          ? res.status(201).json({ message: "Codebase uploaded successfully" })
          : res.status(200).json({
              message: "Project synced successfully",
              details: response.data,
            });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async handleGithubUpload(
    req,
    formData,
    { repositoryUrl, isPrivateRepository, branch = "main", projectId }
  ) {
    try {
      const user = await User.findOne({
        where: { email: req.user.email },
        attributes: ["githubToken"],
      });

      const zipData = await githubService.downloadRepository(
        repositoryUrl,
        branch,
        user.githubToken
      );

      formData.append("file", zipData, {
        filename: "codebase.zip",
        contentType: "application/zip",
      });

      const project = await Project.findOne({
        where: { id: projectId },
      });

      if (!project) {
        return;
      }

      await project.update({
        branchName: branch,
        source: "github",
      });

      if (!project.webhookId && isPrivateRepository) {
        console.log(
          "🔗 [ProjectsController] Setting up GitHub webhook for private repository"
        );
        await webhookService.setupGithubWebhook(
          projectId,
          repositoryUrl,
          branch,
          req.user
        );
        console.log("✅ [ProjectsController] GitHub webhook setup completed");
      }
    } catch (error) {
      throw new Error(`Github download failed: ${error.message}`);
    }
  }

  async handleAzureUpload(req, formData, { repositoryId, branch, projectId }) {
    try {

      const user = await User.findOne({
        where: { email: req.user.email },
        attributes: ["azureAccessToken", "defaultAzureOrganization"],
      });
      console.log(user)

      if (!user.azurePat || !user.azureOrg) {
        throw new Error(
          "Azure credentials not found. Please connect your Azure DevOps account first."
        );
      }

      const data = await azureDevopsService.downloadRepository(
        repositoryId,
        branch,
        user.azurePat,
        user.azureOrg
      );

      formData.append("file", data, {
        filename: "codebase.zip",
        contentType: "application/zip",
      });

      const tempDir = path.join(__dirname, "../../temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(
        tempDir,
        `verify_${projectId}_${Date.now()}.zip`
      );
      fs.writeFileSync(tempFilePath, data);

      await Project.update(
        {
          source: "azure",
          repositoryUrl: repositoryId,
          branchName: branch,
        },
        {
          where: { id: projectId },
        }
      );
    } catch (error) {
      throw new Error(`Azure download failed: ${error.message}`);
    }
  }

  async handleManualUpload(frontendFormData, file) {
    // Create a new FormData object for the Python API
    const pythonFormData = new FormData();
    pythonFormData.append("file", file.buffer, file.originalname);
    pythonFormData.append("source", "manual");

    // Return the FormData object for the Python API
    return pythonFormData;
  }

  async handleGitlabUpload(
    req,
    formData,
    { repositoryUrl, isPrivateRepository, branch = "main", projectId }
  ) {
    try {
      const user = await User.findOne({
        where: { email: req.user.email },
        attributes: ["gitlabToken"],
      });

      if (!user.gitlabToken) {
        throw new Error(
          "GitLab token not found. Please connect your GitLab account first."
        );
      }

      const zipData = await gitlabService.downloadRepository(
        repositoryUrl,
        branch,
        user.gitlabToken
      );

      formData.append("file", zipData, {
        filename: "codebase.zip",
        contentType: "application/zip",
      });

      const project = await Project.findOne({
        where: { id: projectId },
      });

      if (!project) {
        return;
      }

      await project.update({
        branchName: branch,
        source: "gitlab",
      });
    } catch (error) {
      throw new Error(`GitLab download failed: ${error.message}`);
    }
  }

  async sendToPythonAPI(email, project_id, formData, endpoint, source) {
    const url = new URL(`${process.env.PYTHON_URL}/${endpoint}`);
    url.searchParams.append("email", email);
    url.searchParams.append("project_id", project_id);
    url.searchParams.append("commit_id", "manual");
    url.searchParams.append("file_source", source);

    try {
      const response = await axios.post(url.toString(), formData, {
        headers: { ...formData.getHeaders() },
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getAllProjects(req, res) {
    const email = req.user.email;
    try {
      const response = await axios.get(
        `${process.env.PYTHON_URL}/projects?email=${email}`
      );
      const projectIds = response?.data?.projects?.map(
        (project) => project.project_id
      );
      const projects = await Project.findAll({
        where: { id: { [Op.in]: projectIds } },
        attributes: [
          "id",
          "latestCommitHash",
          "latestCommitMessage",
          "branchName",
          "source",
          "repositoryUrl",
          "webhookId",
        ],
      });
      const projectIdMap = projects.reduce((acc, project) => {
        acc[project.id] = project;
        return acc;
      }, {});
      const processedProjects = response?.data?.projects?.map((project) => {
        const projectDetails = projectIdMap[project.project_id];
        if (!projectDetails) {
          return project;
        }
        return {
          ...project,
          latestCommitHash: projectDetails.latestCommitHash,
          latestCommitMessage: projectDetails.latestCommitMessage,
          branchName: projectDetails.branchName,
          source: projectDetails.source,
          repositoryUrl: projectDetails.repositoryUrl,
          latestCommitUrl:
            projectDetails.repositoryUrl +
            "/commit/" +
            projectDetails.latestCommitHash,
          webhookId: projectDetails.webhookId,
        };
      });
      res.status(201).json(processedProjects);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getProjectSummary(req, res) {
    const { projectId } = req.body;
    try {
      const input = new FormData();
      input.append("email", req.user.email);
      input.append("project_id", projectId);

      const response = await axios
        .post(`${process.env.PYTHON_URL}/generate-summary`, input, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .catch((error) => {
          console.log(error);
        });

      res
        .status(200)
        .json({ message: "An email with the summary will be sent shortly" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getProjectMermaidDiagram(req, res) {
    const { projectId } = req.body;
    try {
      const input = new FormData();
      input.append("user_question", "Give me an overall summary");
      input.append("email", req.user.email);
      input.append("project_id", projectId);

      const response = await axios
        .post(`${process.env.PYTHON_URL}/generate-mermaid`, input, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .catch((error) => {
          console.log(error);
        });

      res.status(200).json(response.data?.result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteProject(req, res) {
    const { projectId } = req.body;
    try {
      deleteProjectValidationSchema.validateSync(
        { email: req.user.email, projectId },
        { abortEarly: false }
      );

      const response = await axios
        .post(
          `${process.env.PYTHON_URL}/delete-project`,
          {
            project_id: projectId,
            email: req.user.email,
          },
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        )
        .catch((error) => {
          console.log(error);
        });
      if (response.status == 200) {
        res.status(200).json({ message: "Project deleted successfully" });
      } else {
        res
          .status(403)
          .json({ message: "Error is deleting project", response });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getCollaborators(req, res) {
    try {
      const { project_id } = req.body;

      if (!project_id) {
        return res.status(400).json({
          success: false,
          message: "Project ID is required",
        });
      }

      const response = await axios.post(
        `${process.env.PYTHON_URL}/get_users_for_project`,
        null,
        {
          params: {
            project_id: project_id,
          },
        }
      );

      return res.status(200).json(response.data);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to get collaborators",
        error: error.response?.data?.detail || error.message,
      });
    }
  }

  async addCollaborator(req, res) {
    try {
      const owner_email = req.user.email;
      const { project_id, email, role } = req.body;

      if (!project_id || !email) {
        return res.status(400).json({
          success: false,
          message: "Project ID and collaborator email are required",
        });
      }

      const collaboratorData = {
        [email]: role || "user",
      };

      const response = await axios.post(
        `${process.env.PYTHON_URL}/add_collabrator`,
        collaboratorData,
        {
          params: {
            owner_email,
            project_id,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Collaborator added successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to add collaborator",
        error: error.response?.data?.detail || error.message,
      });
    }
  }

  async deleteCollaborator(req, res) {
    try {
      const { project_id, collaborator_email } = req.body;

      if (!project_id || !collaborator_email) {
        return res.status(400).json({
          success: false,
          message: "Project ID and collaborator email are required",
        });
      }

      const response = await axios.post(
        `${process.env.PYTHON_URL}/delete_user_from_project`,
        null,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          params: {
            project_id,
            email: collaborator_email,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Collaborator removed successfully",
      });
    } catch (error) {
      return res.status(error.response?.status || 500).json({
        success: false,
        message: "Failed to remove collaborator",
        error: error.response?.data?.detail || error.message,
      });
    }
  }

  async downloadReport(req, res) {
    try {
      const email = req.user.email;
      const { project_id, project_name } = req.query;

      if (!project_id || !project_name) {
        return res.status(422).json({
          error:
            "Missing required parameters. project_id and project_name are required.",
        });
      }

      // Create form data
      const formData = new FormData();
      formData.append("project_id", project_id);
      formData.append("email", email);
      formData.append("project_name", project_name);

      // Create URL with query parameters
      const url = new URL(`${process.env.PYTHON_URL}/get_executive_summary`);
      url.searchParams.append("project_id", project_id);
      url.searchParams.append("email", email);
      url.searchParams.append("project_name", project_name);

      // Making request with both query params and FormData
      const response = await axios.post(url.toString(), formData, {
        headers: {
          ...formData.getHeaders(),
          Accept: "application/pdf",
          "Content-Type": "multipart/form-data",
          "Accept-Charset": "UTF-8",
        },
        responseType: "arraybuffer",
        validateStatus: false,
      });

      // Check if the response is an error
      if (response.status !== 200) {
        if (response.data instanceof Buffer) {
          const errorMessage = Buffer.from(response.data).toString("utf-8");
          try {
            const parsedError = JSON.parse(errorMessage);
            return res.status(response.status).json({
              error: parsedError.detail || "Failed to generate report",
              details: parsedError,
            });
          } catch {
            return res.status(response.status).json({
              error: errorMessage || "Failed to generate report",
              raw: errorMessage,
            });
          }
        }
        return res.status(response.status).json({
          error: "Failed to generate report",
          status: response.status,
        });
      }

      // Check if we actually got PDF data
      const contentType = response.headers["content-type"];
      if (!contentType || !contentType.includes("application/pdf")) {
        return res.status(500).json({
          error: "Server did not return a PDF file",
          contentType,
        });
      }

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(
          project_name
        )}_executive_summary.pdf`
      );
      res.setHeader("Content-Length", response.data.length);

      // Send the PDF data
      return res.send(response.data);
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error while generating report",
        message: error.message,
        details: error.response?.data
          ? Buffer.from(error.response.data).toString("utf-8")
          : undefined,
      });
    }
  }
}

// Export a new instance of the controller
const projectsController = new ProjectsController();
module.exports = projectsController;
