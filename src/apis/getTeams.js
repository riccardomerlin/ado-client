import fetch from 'node-fetch';
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

async function getTeams() {
    const url = `${orgUrl}/_apis/projects/${projectName}/teams?api-version=${apiVersion}`;
    const headers = {
        'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`,
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.value; // Returns the list of teams
    } catch (error) {
        console.error('Error fetching teams:', error);
        throw error;
    }
}

export default getTeams;



