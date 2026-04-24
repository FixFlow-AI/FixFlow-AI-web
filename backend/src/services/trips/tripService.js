const Trip = require('../../models/Trip');
const { NotFoundError } = require('../../utils/errors');

async function upsertTripProposal({
  tripId,
  userId,
  workspaceId = null,
  proposalId,
  strategy,
  status,
  title = '',
}) {
  if (!tripId) {
    return null;
  }

  const trip = await Trip.findOne({ tripId, userId });
  if (!trip) {
    return Trip.create({
      tripId,
      userId,
      workspaceId,
      proposals: [{ proposalId, strategy, status, title }],
    });
  }

  const existing = trip.proposals.find((item) => item.proposalId === proposalId);
  if (existing) {
    existing.strategy = strategy;
    existing.status = status;
    existing.title = title || existing.title;
  } else {
    trip.proposals.push({ proposalId, strategy, status, title });
  }

  if (workspaceId && !trip.workspaceId) {
    trip.workspaceId = workspaceId;
  }

  await trip.save();
  return trip;
}

async function getOwnedTrip(tripId, userId) {
  const trip = await Trip.findOne({ tripId, userId });
  if (!trip) {
    throw new NotFoundError('TriProposal session not found');
  }
  return trip;
}

module.exports = {
  upsertTripProposal,
  getOwnedTrip,
};
