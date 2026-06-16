function extractWeeks(value = '') {
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || [];
  if (!numbers.length) {
    return 0;
  }
  return numbers.reduce((sum, current) => sum + current, 0) / numbers.length;
}

function effortCalibrationDelta(records = []) {
  const stats = new Map();

  records.forEach((record) => {
    (record.effortEntries || []).forEach((entry) => {
      const key = String(entry.label || '').trim() || 'General';
      if (!stats.has(key)) {
        stats.set(key, { wonWeeks: [], lostWeeks: [] });
      }

      const target = stats.get(key);
      const weeks = extractWeeks(entry.timeframe);
      if (!weeks) return;

      if (record.status === 'won') {
        target.wonWeeks.push(weeks);
      }
      if (record.status === 'lost') {
        target.lostWeeks.push(weeks);
      }
    });
  });

  return [...stats.entries()]
    .map(([label, value]) => {
      const wonAvg = value.wonWeeks.length
        ? value.wonWeeks.reduce((sum, current) => sum + current, 0) / value.wonWeeks.length
        : 0;
      const lostAvg = value.lostWeeks.length
        ? value.lostWeeks.reduce((sum, current) => sum + current, 0) / value.lostWeeks.length
        : 0;

      return {
        label,
        wonAvg: Math.round(wonAvg * 10) / 10,
        lostAvg: Math.round(lostAvg * 10) / 10,
        delta: Math.round((wonAvg - lostAvg) * 10) / 10,
      };
    })
    .filter((item) => item.wonAvg || item.lostAvg)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

module.exports = {
  effortCalibrationDelta,
  extractWeeks,
};
