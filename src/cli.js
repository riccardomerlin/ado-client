#!/usr/bin/env node

import 'dotenv/config';

const [,, apiName, ...args] = process.argv;

if (!apiName) {
  console.error('Usage: adoCli <apiName> <args>');
  process.exit(1);
}

const apiMap = {
  createPbi: './apis/createPbi.js',
  createTask: './apis/createTask.js',
  createTaskFromTemplate: './apis/createTaskFromTemplate.js',
  getTeams: './apis/getTeams.js',
  getRepositories: './apis/getRepositories.js',
  createPullRequest: './apis/createPullRequest.js',
};

async function runApi(apiName, args) {
  try {
    const apiPath = apiMap[apiName];
    if (!apiPath) {
      console.error(`Unknown API: ${apiName}`);
      process.exit(1);
    }   
    
    const { default: apiFunction } = await import(apiPath);
    const result = await apiFunction(...args);
    console.log('Operation completed successfully');
  } catch (error) {
    console.error('Error during operation:', error.message);
    process.exit(1);
  }
}

runApi(apiName, args);