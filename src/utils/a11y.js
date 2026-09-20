export const handleKeyActivate = (callback) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    callback(e);
  }
};
