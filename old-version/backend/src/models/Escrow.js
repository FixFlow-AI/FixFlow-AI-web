const { createDynamoModel } = require('../db/dynamoModel');

const Escrow = createDynamoModel({
  modelName: 'Escrow',
  defaults: () => ({
    leadId: null,
    clientDid: '',
    freelancerDid: '',
    buyerAddress: '',
    sellerAddress: '',
    state: 'CREATED',
    fundedAt: null,
    totalAmount: 0,
    currency: 'USDC',
    milestones: [],
    contractAddress: '',
    chain: 'Polygon Amoy',
  }),
});

module.exports = Escrow;