(() => {
  const supplied = new URLSearchParams(location.search).get('scope');
  const scope = /^[0-9a-f]{64}$/.test(supplied || '') ? supplied : 'ephemeral-' + crypto.randomUUID();
  const prefix = 'ynext-planner-' + scope + '-';
  const legacy = 'open-planner-studio-recent-files';
  const map = (key) => {
    const text = String(key);
    return text.startsWith('ops-') || text === legacy ? prefix + text : text;
  };
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  Storage.prototype.getItem = function(key) { return originalGet.call(this, map(key)); };
  Storage.prototype.setItem = function(key, value) { return originalSet.call(this, map(key), value); };
  Storage.prototype.removeItem = function(key) { return originalRemove.call(this, map(key)); };
  const originalOpen = indexedDB.open.bind(indexedDB);
  const originalDelete = indexedDB.deleteDatabase.bind(indexedDB);
  indexedDB.open = (name, ...args) => originalOpen(map(name), ...args);
  indexedDB.deleteDatabase = (name) => originalDelete(map(name));
})();
