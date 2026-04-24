function techStackWinRate(records = []) {
  const stats = new Map();

  records.forEach((record) => {
    (record.techTags || []).forEach((tag) => {
      if (!stats.has(tag)) {
        stats.set(tag, { won: 0, lost: 0, total: 0 });
      }

      const entry = stats.get(tag);
      entry.total += 1;
      if (record.status === 'won') {
        entry.won += 1;
      }
      if (record.status === 'lost') {
        entry.lost += 1;
      }
    });
  });

  return [...stats.entries()]
    .map(([tag, value]) => ({
      tag,
      total: value.total,
      won: value.won,
      lost: value.lost,
      winRate: value.total ? Math.round((value.won / value.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total);
}

module.exports = {
  techStackWinRate,
};
