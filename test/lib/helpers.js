function byDays(count) {
  const daySeconds = 86400;
  return count * daySeconds;
}

module.exports = {
  byDays
};
