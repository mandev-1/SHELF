/**
 * ShELF background: handles LLM Console flow.
 * - openLLMConsole: navigate tab to LLM URL (overlay auto-shows via content script)
 * - closeLLMConsole: open Dashboard in new tab
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "openLLMConsole") {
    const url = (msg.url || "").trim();
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      sendResponse({ ok: false, error: "Invalid URL" });
      return true;
    }
    handleOpenLLMConsole(url).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "closeLLMConsole") {
    handleCloseLLMConsole().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "openPromptLibrary") {
    handleOpenPromptLibrary().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

async function handleOpenLLMConsole(url) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const targetTabId = tab?.id;
  if (!targetTabId) {
    return { ok: false, error: "No active tab" };
  }
  await chrome.tabs.update(targetTabId, { url });
  return { ok: true, tabId: targetTabId };
}

async function handleCloseLLMConsole() {
  const dashboardUrl = chrome.runtime.getURL("index.html");
  await chrome.tabs.create({ url: dashboardUrl });
  return { ok: true };
}

async function handleOpenPromptLibrary() {
  const dashboardUrl = chrome.runtime.getURL("index.html");
  await chrome.tabs.create({ url: dashboardUrl });
  return { ok: true };
}
