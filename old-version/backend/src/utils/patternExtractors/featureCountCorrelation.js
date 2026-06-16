function average(values = []) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function featureCountCorrelation(records = []) {
  const wonCounts = records.filter((record) => record.status === 'won').map((record) => record.featureCount || 0);
  const lostCounts = records.filter((record) => record.status === 'lost').map((record) => record.featureCount || 0);
  const combined = [...wonCounts, ...lostCounts].sort((a, b) => a - b);

  if (!combined.length) {
    return {
      wonAverage: 0,
      lostAverage: 0,
      optimalRange: [0, 0],
      dropoff: 'n/a',
    };
  }

  const lower = wonCounts.length ? Math.max(1, Math.min(...wonCounts)) : combined[0];
  const upper = wonCounts.length ? Math.max(lower, Math.max(...wonCounts)) : combined[combined.length - 1];

  return {
    wonAverage: Math.round(average(wonCounts) * 10) / 10,
    lostAverage: Math.round(average(lostCounts) * 10) / 10,
    optimalRange: [lower, upper],
    dropoff: upper ? `>${upper}` : 'n/a',
  };
}

module.exports = {
  featureCountCorrelation,
};
