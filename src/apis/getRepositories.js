import fetch from 'node-fetch';
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

async function getRepositories() {
    const url = `${orgUrl}/${projectName}/_apis/git/repositories?api-version=${apiVersion}`;

    const headers = {
        'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`,
    };
    
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status} ${response.statusText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.value;
    } catch (error) {
        console.error('Error fetching repositories:', error);
        throw error;
    }
}

export default getRepositories;
