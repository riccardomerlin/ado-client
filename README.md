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

Create a `.env` file in the root folder of the project with the PAT just
generated:

```text
ADO_CLIENT_PAT=<your_PAT>
```

Open up `./config.json` and fill out all the fields (you can copy from `config.example.json`):

```json
{
    "orgUrl": "https://dev.azure.com/your-organization",
    "projectName": "your-project-name",
    "teamId": "your-team-id-guid",
    "apiVersion": "7.1",
    "port": 7010
}
```

Go to `https://<your_organization_ado_url>/<Your_ADO_Project_Name>/_settings/work-team?type=Task&_a=templates` and add your `Task Templates`.

Run `npm start` and navigate to [http://localhost:7010](http://localhost:7010)
to open up the web page to add predefined tasks to a PBI.

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
