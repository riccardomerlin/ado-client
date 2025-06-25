import fetch from 'node-fetch';
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, teamId, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function createTaskFromTemplate(templateId, parentId) {
    if (!templateId || !parentId) {
        throw new Error(`Missing required parameters. templateId: ${JSON.stringify(templateId)}, parentId: ${JSON.stringify(parentId)}`);
    }

    const templateUrl = `${orgUrl}/${projectName}/${teamId}/_apis/wit/templates/${templateId}?api-version=${apiVersion}`;
    const createUrl = `${orgUrl}/${projectName}/_apis/wit/workitems/$Task?api-version=${apiVersion}`;

    // Fetch the template
    const templateResponse = await fetch(templateUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
        }
    });

    if (!templateResponse.ok) {
        const error = await templateResponse.json();
        throw new Error(`Failed to fetch template: ${templateResponse.status} ${templateResponse.statusText} - ${JSON.stringify(error)}`);
    }

    const template = await templateResponse.json();

    // Create the task using the template
    const body = Object.entries(template.fields)
        .map(([key, value]) => ({
            op: 'add',
            path: `/fields/${key}`,
            from: null,
            value: value
        }));

    if (parentId) {
        body.push(
            {
                op: 'add',
                path: '/relations/-',
                from: null,
                value: {
                    rel: 'System.LinkTypes.Hierarchy-Reverse',
                    url: `${orgUrl}/_apis/wit/workItems/${parentId}`,
                    attributes: {
                        comment: 'add parent'
                    }
                }
            }
        );

        const parentUrl = `${orgUrl}/${projectName}/_apis/wit/workitems/${parentId}?api-version=${apiVersion}`;
        const parentResponse = await fetch(parentUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
            }
        });

        if (!parentResponse.ok) {
            const error = await parentResponse.json();
            throw new Error(`Failed to fetch parent: ${parentResponse.status} ${parentResponse.statusText} - ${JSON.stringify(error)}`);
        }

        const parent = await parentResponse.json();
        const parentAreaPath = parent.fields['System.AreaPath'];
        body.push(
        {
            op: 'add',
            path: '/fields/System.AreaPath',
            from: null,
            value: parentAreaPath
        });

        const parentIterationPath = parent.fields['System.IterationPath'];
        body.push(
        {
            op: 'add',
            path: '/fields/System.IterationPath',
            from: null,
            value: parentIterationPath
        });
    }

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json-patch+json',
            'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
        }
    };

    const response = await fetch(createUrl, {
        ...options,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create Task: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return result;
}
