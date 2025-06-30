ADO Client
===

This is a NodeJs client for Azure Dev Ops that overcomes the limitation of
being able to create multiple workitems in bulk from predefined templates.

Get started
---

First thing, clone the repo.
```bash
git clone https://github.com/riccardomerlin/ado-client.git
cd ado-client
```

You need an Personal Access Token (PAT) to access your organisation ADO
with the following permissions:

- Work Items `Read, write & manage`
- Code `Read`
- Project & Teams `Read`

Create a `.env` file in the root folder of the project with your configuration:

```bash
# Azure DevOps Configuration
ORG_URL=https://dev.azure.com/your-organization
PROJECT_NAME=your-project-name
TEAM_ID=your-team-id-guid
API_VERSION=7.1
PORT=7010
DEFAULT_RELEASE=25R3
DEFAULT_AREA_PATH=your-project\\your-area-path
RELEASE_FIELD_NAME=Your.Custom.Release.Field
DEFAULT_RELATIONSHIP_STRATEGY=hierarchy-with-related

# Azure DevOps Personal Access Token
ADO_CLIENT_PAT=your_personal_access_token_here
```

Go to `https://<your_organization_ado_url>/<Your_ADO_Project_Name>/_settings/work-team?type=Task&_a=templates` and add your `Task Templates`.

## Local Development

Run `npm start` and navigate to [http://localhost:7010](http://localhost:7010)
to open up the web page to add predefined tasks to a PBI.

## Deploy to AWS App Runner

This application is optimized for deployment on AWS App Runner, which provides:
- **Pay-per-use pricing** - Only pay when your app is processing requests
- **Automatic scaling** - Scales from 0 to handle traffic spikes
- **Zero infrastructure management** - Fully managed service
- **Minimal resources** - Starts with 0.25 vCPU, 0.5 GB RAM

### Option 1: GitHub Source Deployment (Recommended)

This is the simplest approach - App Runner builds and deploys directly from your GitHub repository.

```bash
# Deploy from GitHub repository
.\deploy-apprunner.ps1 -GitHubRepo "https://github.com/yourusername/ado-client"

# Setup environment variables
npm run setup:apprunner
```

### Option 2: Container Deployment

If you prefer container deployment:

```bash
# Setup IAM roles (one-time)
.\deploy-apprunner.ps1 -Setup

# Deploy using ECR container
.\deploy-apprunner.ps1 -UseECR
```

### Environment Variables for App Runner

Set these environment variables in your App Runner service:

- `ORG_URL` - Your Azure DevOps organization URL
- `PROJECT_NAME` - Your ADO project name  
- `TEAM_ID` - Your team GUID
- `API_VERSION` - ADO API version (usually 7.1)
- `DEFAULT_RELEASE` - Default release name
- `DEFAULT_AREA_PATH` - Default area path
- `RELEASE_FIELD_NAME` - Custom release field name
- `DEFAULT_RELATIONSHIP_STRATEGY` - Relationship strategy
- `ADO_CLIENT_PAT` - Your Personal Access Token (**Keep this secret!**)

### App Runner Benefits

- **Cost-effective**: No charges when idle, minimal cost when running
- **Simple**: No Docker knowledge needed for GitHub deployment
- **Automatic**: Auto-deploys when you push to your main branch
- **Scalable**: Handles traffic spikes automatically

CLI
---

Besides the web Ui, a small set of cli commands is also available to use.

To install the CLI, run the following command from the project root folder:

```bash
npm install -g
```

Run `adoCli` to verify that the command is installed peroperly.
You should see this output:

```bash
Usage: adoCli <apiName> <args>
```

In [cli.js](./src/cli.js) you can see the available `<apiName>` then `<args>`
varies from command to command. You can check out the arguments defined in each
api in this folder `./src/apis/` and then apply them positionally in sequence.
Some parameters may be optinal others mandatory.

### Examples

```bash
adoCli getTeams

adoCli createTask "title" "parentId" "description" "assignedTo"
```

Why this project?
---

In my team, we often create Product Backlog Items (PBIs) as we discover more
work to be done. As part of the refinement process, we have a session together
where we ensure each PBI has all the necessary tasks. When all tasks are done,
the PBI is done too.

Tasks don't vary much, it is mostly a matter of deciding if we need a task
or not for the perticular PBI we are refining.
We then created `Task Templates` so, with less effort, we could add each task
to the PBIs without having to fill out the necessary fields.
That was an improvement for sure! But... the clicks necessary for adding each
task were still a lot considering that we could have up to 7-8 tasks per PBI.

I've then decided to build a tool that would:

1. take a PBI number as imput
1. read all avaible ADO templates for the team
1. add the selected task templates to the chosen PBI

Hey presto, `ado-client`!
