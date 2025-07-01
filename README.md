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

This application is optimized for deployment on AWS App Runner using secure environment variables from AWS SSM Parameter Store and container images from ECR.

### Secure Deployment Workflow (2025+)

1. **Set up environment variables in SSM Parameter Store:**
   ```powershell
   .\setup-secure-env-simple.ps1
   ```
   This script is copy-paste friendly and loads defaults from your `.env` file if present. It will prompt you for all required variables, including secrets.

2. **Deploy to App Runner using ECR container:**
   ```powershell
   .\deploy-apprunner-with-env.ps1
   ```
   This builds, pushes, and deploys your container, injecting all environment variables from SSM at creation.

3. **Update environment variables on a running service:**
   ```powershell
   .\update-apprunner-env.ps1
   ```
   Use this if you need to update environment variables after the service is running.

4. **Monitor deployment:**
   ```powershell
   aws apprunner describe-service --service-arn <arn> --region <region>
   aws apprunner list-services --region <region>
   ```

5. **Access your app:**
   Visit the App Runner public URL shown in the deployment output.

#### Required Environment Variables (managed in SSM)
- `ORG_URL` - Your Azure DevOps organization URL
- `PROJECT_NAME` - Your ADO project name
- `TEAM_ID` - Your team GUID
- `API_VERSION` - ADO API version (usually 7.1)
- `PORT` - Server port (default: 3000)
- `DEFAULT_RELEASE` - Default release name
- `DEFAULT_AREA_PATH` - Default area path
- `RELEASE_FIELD_NAME` - Custom release field name
- `DEFAULT_RELATIONSHIP_STRATEGY` - Relationship strategy
- `ADO_CLIENT_PAT` - Your Personal Access Token (**Keep this secret!**)

> **Note:** All secrets are stored securely in SSM Parameter Store. No secrets are present in code, YAML, or Dockerfiles.

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
