importScripts('defaults.js');

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-discreet') return;
  const r = await chrome.storage.local.get(VS_KEY);
  const s = vsLoad(r[VS_KEY]);
  s.discreet = !s.discreet;
  await chrome.storage.local.set({ [VS_KEY]: s });
});
