function average(values = []) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidenceThreshold(records = []) {
  const wonScores = records.filter((record) => record.status === 'won').map((record) => record.confidenceScore || 0);
  const lostScores = records.filter((record) => record.status === 'lost').map((record) => record.confidenceScore || 0);
  const wonAvg = average(wonScores);
  const lostAvg = average(lostScores);

  return {
    wonAverage: Math.round(wonAvg * 10) / 10,
    lostAverage: Math.round(lostAvg * 10) / 10,
    threshold: Math.round(((wonAvg + lostAvg) / 2) * 10) / 10,
  };
}

module.exports = {
  confidenceThreshold,
};
