const { createDynamoModel } = require('../db/dynamoModel');

function buildAgentConfig() {
  return {
    leadHunter: true,
    outreachWriter: true,
    escrowWatcher: true,
    credentialMinter: false,
  };
}

function buildProfileDefaults() {
  return {
    upwork: {
      headline: '',
      summary: '',
      rate: 0,
    },
    linkedin: {
      headline: '',
      about: '',
    },
    personal: {
      tagline: '',
      bio: '',
    },
  };
}

function buildGithubScanDefaults() {
  return {
    repos: [],
    languages: [],
    commits: 0,
    scannedAt: null,
  };
}

const FreelancerProfile = createDynamoModel({
  modelName: 'FreelancerProfile',
  defaults: () => ({
    did: '',
    walletAddresses: {
      fixflow: '',
      usdc: '',
      matic: '',
    },
    profiles: buildProfileDefaults(),
    agentConfig: buildAgentConfig(),
    githubScan: buildGithubScanDefaults(),
    onboardedAt: null,
  }),
});

module.exports = FreelancerProfile;
