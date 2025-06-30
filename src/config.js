import 'dotenv/config';

// Load configuration from environment variables
const config = {
  orgUrl: process.env.ORG_URL,
  projectName: process.env.PROJECT_NAME,
  teamId: process.env.TEAM_ID,
  apiVersion: process.env.API_VERSION,
  port: parseInt(process.env.PORT) || 7010,
  defaultRelease: process.env.DEFAULT_RELEASE,
  defaultAreaPath: process.env.DEFAULT_AREA_PATH,
  releaseFieldName: process.env.RELEASE_FIELD_NAME,
  defaultRelationshipStrategy: process.env.DEFAULT_RELATIONSHIP_STRATEGY || 'hierarchy-only'
};

// Validate required environment variables
const requiredVars = ['ORG_URL', 'PROJECT_NAME', 'TEAM_ID', 'API_VERSION'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file or environment variable configuration.');
  process.exit(1);
}

export default config;
