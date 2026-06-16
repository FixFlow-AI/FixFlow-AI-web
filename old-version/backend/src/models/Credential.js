const { createDynamoModel } = require('../db/dynamoModel');

const Credential = createDynamoModel({
  modelName: 'Credential',
  defaults: () => ({
    proof: '',
    issuerDid: '',
    subjectDid: '',
    evidence: {
      escrowTx: '',
      githubCommit: '',
      leadName: '',
    },
    mintedAt: new Date().toISOString(),
    soulbound: true,
    status: 'ready',
  }),
});

module.exports = Credential;
