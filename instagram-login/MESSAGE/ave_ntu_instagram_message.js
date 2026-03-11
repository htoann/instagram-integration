// const API_BASE_URL =
//   "https://testinsforcrm-fgh0cxbnfjf9f9az.australiasoutheast-01.azurewebsites.net";
const API_BASE_URL =
  "https://azapp-eit-onentu-dev-gehnf7acbee2fub6.southeastasia-01.azurewebsites.net";
const apiUrl = (path) => `${API_BASE_URL}${path}`;

const CONFIG = {
  loginEndpoint: apiUrl("/auth/message/login"),
  conversationsEndpoint: (userId) =>
    apiUrl(`/conversations?userId=${encodeURIComponent(userId)}`),
  messagesEndpoint: (conversationId, after) => {
    const params = new URLSearchParams({ limit: "30" });
    if (after) params.set("after", after);
    return apiUrl(`/messages/${encodeURIComponent(conversationId)}?${params}`);
  },
  streamEndpoint: apiUrl("/stream"),
  sendEndpoint: apiUrl("/messages/send"),
  tokenKey: "instagramAccessToken",
  userIdKey: "instagramUserId",
  usernameKey: "instagramUsername",
  pageIdKey: "instagramPageId",
};

const trustedOrigin = API_BASE_URL;
const state = {
  pendingLogin: null,
  stream: null,
  streamReconnectTimer: null,
  streamRetryCount: 0,
  hasLoadedConversations: false,
  messageRenderSeq: 0,
  messagesPagingAfter: null,
  loadingOlderMessages: false,
  refreshInFlight: false,
  selectedConversation: null,
  selectedRecipientId: null,
  currentRecipientUsername: null,
  myUserId: null,
  myUsername: null,
  myParticipantId: null,
};

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(
  [
    "loginBtn",
    "chatSection",
    "conversationList",
    "conversationLoading",
    "chatBox",
    "chatLoading",
    "messageInput",
    "sendBtn",
    "chatHeader",
    "headerAvatar",
    "headerName",
  ].map((id) => [id, $(id)]),
);

const getToken = () => localStorage.getItem(CONFIG.tokenKey);
const setToken = (token) => localStorage.setItem(CONFIG.tokenKey, token);
const clearToken = () => localStorage.removeItem(CONFIG.tokenKey);
const getUserId = () => localStorage.getItem(CONFIG.userIdKey);
const setUserId = (id) =>
  id
    ? localStorage.setItem(CONFIG.userIdKey, id)
    : localStorage.removeItem(CONFIG.userIdKey);
const getUsername = () => localStorage.getItem(CONFIG.usernameKey);
const setUsername = (name) =>
  name
    ? localStorage.setItem(CONFIG.usernameKey, name)
    : localStorage.removeItem(CONFIG.usernameKey);
const getPageId = () => localStorage.getItem(CONFIG.pageIdKey);
const setPageId = (id) =>
  id
    ? localStorage.setItem(CONFIG.pageIdKey, id)
    : localStorage.removeItem(CONFIG.pageIdKey);
const toMessage = (error) => error?.message || error || "Unknown error";
const toErrorText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};
const resolveApiErrorMessage = (errorLike) => {
  const payload = errorLike?.payload || errorLike;
  const graphError =
    payload?.error?.error ||
    payload?.error ||
    payload?.errors?.[0] ||
    null;

  const userTitle = toErrorText(graphError?.error_user_title);
  const userMessage = toErrorText(graphError?.error_user_msg);
  if (userTitle && userMessage) return `${userTitle}: ${userMessage}`;
  if (userMessage) return userMessage;
  if (userTitle) return userTitle;

  const genericMessage =
    toErrorText(graphError?.message) ||
    toErrorText(payload?.message) ||
    toErrorText(payload?.error?.message) ||
    toErrorText(errorLike?.message);

  return genericMessage || "Something went wrong while calling the API.";
};
const showApiErrorAlert = (errorLike) => {
  const message = resolveApiErrorMessage(errorLike);
  window.alert(message);
};
const tokenExpired = (error) =>
  error?.status === 401 || error?.payload?.code === "TOKEN_EXPIRED";
const EMPTY_CHAT_TEXT = "No messages yet.";
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
const toggleHidden = (element, isHidden) =>
  element.classList.toggle("hidden", isHidden);
const updateComposerVisibility = () => {
  const hasSelectedConversation = Boolean(state.selectedConversation);
  toggleHidden(ui.messageInput, !hasSelectedConversation);
  toggleHidden(ui.sendBtn, !hasSelectedConversation);
};
const setLoading = (key, isLoading) => toggleHidden(ui[key], !isLoading);
const withLoading = (key, fn) =>
  (async () => {
    setLoading(key, true);
    try {
      return await fn();
    } finally {
      setLoading(key, false);
    }
  })();

const completePendingLogin = (handler) => {
  if (!state.pendingLogin) return;
  const current = state.pendingLogin;
  state.pendingLogin = null;
  clearInterval(current.closeTimer);
  handler(current);
};

const stopStream = () => {
  if (state.streamReconnectTimer) {
    clearTimeout(state.streamReconnectTimer);
    state.streamReconnectTimer = null;
  }
  if (!state.stream) return;
  console.log("[Stream] Stopping stream");
  state.stream.close();
  state.stream = null;
};

const renderAuthState = () => {
  const loggedIn = Boolean(getToken());
  toggleHidden(ui.loginBtn, loggedIn);
  toggleHidden(ui.chatSection, !loggedIn);
  // chat header is shown only when a conversation is selected
  toggleHidden(ui.chatHeader, true);
  updateComposerVisibility();
};

const resetSession = () => {
  state.streamRetryCount = 0;
  clearToken();
  setUserId(null);
  setUsername(null);
  setPageId(null);
  state.myUserId = null;
  state.myUsername = null;
  renderAuthState();
  stopStream();
};

const updateChatHeader = () => {
  if (!state.currentRecipientUsername) {
    toggleHidden(ui.chatHeader, true);
    ui.chatHeader.onclick = null;
    return;
  }

  ui.headerName.textContent = state.currentRecipientUsername;
  toggleHidden(ui.chatHeader, false);
  ui.chatHeader.onclick = () => {
    window.open(
      `https://instagram.com/${encodeURIComponent(
        state.currentRecipientUsername,
      )}`,
      "_blank",
    );
  };
};

const selectConversation = async (
  conversationId,
  recipientId,
  username,
  { shouldLoadMessages = true } = {},
) => {
  if (!conversationId) return;
  state.selectedConversation = conversationId;
  state.selectedRecipientId = recipientId || null;
  state.currentRecipientUsername = username || null;
  const prevSelected = ui.conversationList.querySelector("li.selected");
  if (prevSelected) prevSelected.classList.remove("selected");
  const nextSelected = [...ui.conversationList.children].find(
    (li) => li.dataset.conversationId === conversationId,
  );
  if (nextSelected) nextSelected.classList.add("selected");
  updateChatHeader();
  updateComposerVisibility();
  if (shouldLoadMessages) await loadMessages();
};

const isMe = (userLike) => {
  const candidateId = userLike?.id ?? null;
  const candidateName = userLike?.username ?? null;
  const ids = [state.myParticipantId, state.myUserId];
  return (
    (candidateId && ids.some((id) => id === candidateId)) ||
    (state.myUsername && candidateName === state.myUsername)
  );
};

const resolveMyParticipantIdFromParticipants = (participants = []) => {
  if (state.myParticipantId || !state.myUsername) return;
  state.myParticipantId =
    participants.find((p) => p?.username === state.myUsername)?.id ?? null;
  if (state.myParticipantId && state.myParticipantId !== state.myUserId) {
    console.log(
      "[PageId] Discovered from participants:",
      state.myParticipantId,
    );
    setPageId(state.myParticipantId);
  }
};

const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });
  const data = parseJson(await res.text());
  if (res.ok) return data;

  const error = new Error(resolveApiErrorMessage(data) || res.statusText);
  error.status = res.status;
  error.payload = data;
  error.isApiError = true;
  throw error;
};

const normalizeMessages = (messages) =>
  [...messages]
    .filter((item) => item && typeof item === "object")
    .sort(
      (a, b) =>
        new Date(a.created_time || 0) - new Date(b.created_time || 0),
    );

const getMessageAttachments = (msg) => {
  const source = msg?.attachments;
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.data)) return source.data;
  return [];
};

const createImageAttachment = (attachment) => {
  const imageUrl =
    attachment?.image_data?.url ||
    attachment?.url ||
    attachment?.file_url ||
    "";
  if (!imageUrl) return null;

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = attachment?.name || "image";
  image.style.maxWidth = "200px";
  image.style.maxHeight = "200px";
  image.style.display = "block";
  image.style.marginBottom = "4px";
  image.style.cursor = "pointer";
  image.onclick = () => {
    if (image.src) window.open(image.src, "_blank");
  };
  return image;
};

const createFileAttachment = (attachment) => {
  const fileUrl =
    attachment?.file_url ||
    attachment?.url ||
    attachment?.image_data?.url ||
    "";
  const link = document.createElement("a");
  link.href = fileUrl || "#";
  link.textContent = "Attachment";
  link.target = "_blank";
  link.rel = "noopener";
  if (fileUrl) link.download = "";
  link.style.display = "block";
  link.style.marginBottom = "4px";
  return link;
};

const createMessageBubble = (msg) => {
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  const attachments = getMessageAttachments(msg);
  let hasImageAttachment = false;
  let hasNonImageAttachment = false;

  for (const attachment of attachments) {
    const type = String(attachment?.type || "").toLowerCase();
    const isImage =
      type.startsWith("image") || Boolean(attachment?.image_data?.url);

    if (isImage) {
      const image = createImageAttachment(attachment);
      if (image) {
        hasImageAttachment = true;
        bubble.appendChild(image);
        continue;
      }
    }

    hasNonImageAttachment = true;
    bubble.appendChild(createFileAttachment(attachment));
  }

  const hasText = Boolean(msg.message && String(msg.message).trim());
  if (hasText) {
    const textNode = document.createElement("div");
    textNode.textContent = msg.message;
    bubble.appendChild(textNode);
  }

  if (hasImageAttachment && !hasNonImageAttachment && !hasText) {
    bubble.classList.add("image-only");
  }

  if (!bubble.childElementCount) {
    const fallbackText = document.createElement("div");
    fallbackText.textContent = "(attachment)";
    bubble.appendChild(fallbackText);
  }

  return bubble;
};

const setChatEmptyState = (message = EMPTY_CHAT_TEXT) => {
  ui.chatBox.classList.add("empty");
  ui.chatBox.textContent = message;
};

const waitForImageLoad = (image) =>
  new Promise((resolve) => {
    if (image.complete) {
      resolve();
      return;
    }
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  });

const scrollChatToEnd = () => {
  const box = ui.chatBox;
  if (!box) return;
  box.scrollTop = box.scrollHeight;
};

const renderMessages = async (messages) => {
  const renderSeq = ++state.messageRenderSeq;
  if (!messages.length) {
    setChatEmptyState();
    return;
  }

  const fragment = document.createDocumentFragment();
  const imageLoads = [];

  messages.forEach((msg) => {
    const item = document.createElement("div");
    item.className = `msg${isMe(msg?.from) ? " me" : ""}`;

    const bubble = createMessageBubble(msg);
    bubble.querySelectorAll("img").forEach((img) => {
      imageLoads.push(waitForImageLoad(img));
    });
    item.appendChild(bubble);

    fragment.appendChild(item);
  });

  if (imageLoads.length) {
    await Promise.allSettled(imageLoads);
  }

  if (renderSeq !== state.messageRenderSeq) return;

  ui.chatBox.classList.remove("empty");
  ui.chatBox.innerHTML = "";
  ui.chatBox.appendChild(fragment);
  scrollChatToEnd();
};

const getRecipientFromConversation = (conversation) => {
  const participants = conversation?.participants?.data || [];
  resolveMyParticipantIdFromParticipants(participants);
  return participants.find((p) => !isMe(p)) || null;
};

const createConversationListItem = (
  conversation,
  username,
  recipientId,
) => {
  const li = document.createElement("li");
  li.textContent = username;
  li.dataset.conversationId = conversation.id;
  li.dataset.recipientId = recipientId || "";
  li.dataset.username = username;
  li.addEventListener("click", () => {
    selectConversation(
      conversation.id,
      li.dataset.recipientId,
      li.dataset.username,
    ).catch(console.error);
  });
  return li;
};

const loadConversations = async ({ showLoading = true } = {}) => {
  const run = async () => {
    if (!state.myUserId) {
      console.error("Cannot load conversations: myUserId is not set.");
      return [];
    }
    const data = await apiFetch(CONFIG.conversationsEndpoint(state.myUserId));
    state.myParticipantId = null;
    const conversations = data.conversations || [];
    const previousSelection = state.selectedConversation;
    ui.conversationList.innerHTML = "";
    if (!conversations.length) {
      state.selectedConversation = null;
      state.selectedRecipientId = null;
      state.currentRecipientUsername = null;
      updateChatHeader();
      updateComposerVisibility();
      setChatEmptyState(
        "No conversations found. Ask someone to message your IG account first.",
      );
      state.hasLoadedConversations = true;
      return conversations;
    }

    const fragment = document.createDocumentFragment();
    conversations.forEach((conversation, index) => {
      const recipient = getRecipientFromConversation(conversation);
      const username = recipient?.username || `Conversation ${index + 1}`;
      fragment.appendChild(
        createConversationListItem(conversation, username, recipient?.id),
      );
    });
    ui.conversationList.appendChild(fragment);

    const selectedItem = [...ui.conversationList.querySelectorAll("li")].find(
      (li) => li.dataset.conversationId === previousSelection,
    );

    if (selectedItem) {
      await selectConversation(
        selectedItem.dataset.conversationId,
        selectedItem.dataset.recipientId,
        selectedItem.dataset.username,
        { shouldLoadMessages: false },
      );
    } else {
      state.selectedConversation = null;
      state.selectedRecipientId = null;
      state.currentRecipientUsername = null;
      updateChatHeader();
      updateComposerVisibility();
      setChatEmptyState("Select a conversation to view messages.");
    }
    state.hasLoadedConversations = true;
    return conversations;
  };

  const shouldShowLoading = showLoading && !state.hasLoadedConversations;
  if (shouldShowLoading) return withLoading("conversationLoading", run);
  return run();
};

const loadMessages = async ({ showLoading = true } = {}) => {
  if (!state.selectedConversation) return;
  const run = async () => {
    const data = await apiFetch(CONFIG.messagesEndpoint(state.selectedConversation));
    const messages = normalizeMessages(data.messages || []);
    state.messagesPagingAfter = data.paging?.cursors?.after || null;

    if (!state.myParticipantId && state.myUsername) {
      const mine = messages.find((msg) => msg?.from?.username === state.myUsername);
      if (mine?.from?.id) state.myParticipantId = mine.from.id;
    }

    await renderMessages(messages);
  };

  if (showLoading) await withLoading("chatLoading", run);
  else await run();
};

const loadOlderMessages = async () => {
  if (
    !state.selectedConversation ||
    !state.messagesPagingAfter ||
    state.loadingOlderMessages
  )
    return;

  state.loadingOlderMessages = true;
  try {
    const data = await apiFetch(
      CONFIG.messagesEndpoint(
        state.selectedConversation,
        state.messagesPagingAfter,
      ),
    );
    const olderMessages = normalizeMessages(data.messages || []);
    state.messagesPagingAfter = data.paging?.cursors?.after || null;

    if (!olderMessages.length) return;

    const box = ui.chatBox;
    const previousScrollHeight = box.scrollHeight;
    const fragment = document.createDocumentFragment();
    const imageLoads = [];

    olderMessages.forEach((msg) => {
      const item = document.createElement("div");
      item.className = `msg${isMe(msg?.from) ? " me" : ""}`;
      const bubble = createMessageBubble(msg);
      bubble.querySelectorAll("img").forEach((img) => {
        imageLoads.push(waitForImageLoad(img));
      });
      item.appendChild(bubble);
      fragment.appendChild(item);
    });

    if (imageLoads.length) await Promise.allSettled(imageLoads);

    const firstMsg = box.querySelector(".msg");
    if (firstMsg) {
      box.insertBefore(fragment, firstMsg);
    } else {
      box.appendChild(fragment);
    }

    box.scrollTop = box.scrollHeight - previousScrollHeight;
  } catch (error) {
    if (tokenExpired(error)) return resetSession();
    if (error?.isApiError) showApiErrorAlert(error);
    console.error("Load more failed:", error);
  } finally {
    state.loadingOlderMessages = false;
  }
};

ui.chatBox.addEventListener("scroll", () => {
  if (ui.chatBox.scrollTop <= 20) {
    loadOlderMessages();
  }
});

const refreshAll = async ({
  showConversationLoading = false,
  showMessageLoading = false,
} = {}) => {
  const conversations = await loadConversations({
    showLoading: showConversationLoading,
  });
  if (!conversations.length || !state.selectedConversation) return;
  await loadMessages({ showLoading: showMessageLoading });
};

const refreshAllSafe = async (options) => {
  if (state.refreshInFlight) {
    return;
  }
  state.refreshInFlight = true;
  try {
    await refreshAll(options);
  } catch (error) {
    if (tokenExpired(error)) return resetSession();
    if (error?.isApiError) showApiErrorAlert(error);
    console.error("[Refresh] Failed:", error);
  } finally {
    state.refreshInFlight = false;
  }
};

const startStream = () => {
  stopStream();
  const token = getToken();
  if (!token) return;

  const streamUrl = `${CONFIG.streamEndpoint}?${new URLSearchParams({
    ...(state.myUserId ? { userId: state.myUserId } : {}),
    ...(getPageId() ? { pageId: getPageId() } : {}),
  })}`;

  const abortController = new AbortController();
  state.stream = { close: () => abortController.abort() };

  fetch(streamUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: abortController.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Stream HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const read = () =>
        reader.read().then(({ done, value }) => {
          if (done) {
            handleStreamError();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const payload = parseJson(line.slice(6));
                if (
                  payload &&
                  typeof payload === "object" &&
                  payload.type &&
                  payload.type !== "connected"
                ) {
                  state.streamRetryCount = 0;
                  refreshAllSafe();
                }
              } catch (e) {
                /* ignore parse errors */
              }
            }
          }
          read();
        });
      read();
    })
    .catch((err) => {
      if (err.name === "AbortError") return;
      handleStreamError();
    });
};

const handleStreamError = () => {
  console.warn(
    "[Stream] handleStreamError called | hasToken:",
    Boolean(getToken()),
    "| retryCount:",
    state.streamRetryCount,
  );
  if (!getToken()) return;
  stopStream();

  const maxRetries = 2;
  if (getToken() && state.streamRetryCount < maxRetries) {
    state.streamRetryCount += 1;
    const delayMs = Math.min(1500 * state.streamRetryCount, 30000);
    console.warn(
      `[Stream] Reconnecting (attempt ${state.streamRetryCount}/${maxRetries}) in ${delayMs}ms`,
    );
    state.streamReconnectTimer = setTimeout(startStream, delayMs);
    return;
  }

  if (!getToken()) resetSession();
  else {
    console.error(
      "[Stream] Failed to reconnect after max retries. Manual reconnection needed.",
    );
  }
};

const connectRealtime = async () => {
  console.log("[Realtime] Connecting... userId:", state.myUserId);
  state.streamRetryCount = 0;
  await refreshAllSafe({ showConversationLoading: true });
  startStream();
};

const guarded =
  (label, fn) =>
    async (...args) => {
      try {
        await fn(...args);
      } catch (error) {
        if (tokenExpired(error)) return resetSession();
        if (error?.isApiError) showApiErrorAlert(error);
        console.error(`${label}:`, error);
      }
    };

const openLoginPopup = () =>
  new Promise((resolve, reject) => {
    const POPUP_CLOSE_GRACE_MS = 1500;
    const popup = window.open(
      CONFIG.loginEndpoint,
      "instagramMessageLoginPopup",
      "width=520,height=720",
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups and try again."));
      return;
    }

    const closeTimer = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(closeTimer);
      setTimeout(() => {
        completePendingLogin(({ reject: rejectLogin }) =>
          rejectLogin(
            new Error(
              "Something went wrong.",
            ),
          ),
        );
      }, POPUP_CLOSE_GRACE_MS);
    }, 400);

    state.pendingLogin = { resolve, reject, closeTimer };
  });

window.addEventListener("message", (event) => {
  if (event.origin !== trustedOrigin) return;
  const { type, accessToken, error, username, userId, pageId } =
    event.data || {};

  if (type === "instagram_oauth_success" && accessToken) {
    state.myUsername = username || state.myUsername || null;
    state.myUserId = userId || state.myUserId || null;
    setToken(accessToken);
    setUserId(state.myUserId);
    setUsername(state.myUsername);
    setPageId(pageId || null);
    renderAuthState();
    completePendingLogin(({ resolve }) => resolve(accessToken));
    return;
  }
});

ui.loginBtn.addEventListener("click", async () => {
  try {
    await openLoginPopup();
    await connectRealtime();
  } catch (error) {
    if (error?.isApiError) showApiErrorAlert(error);
    console.error("Login failed:", error);
  }
});

const sendMessage = guarded("Send failed", async () => {
  const message = ui.messageInput.value.trim();
  if (!state.selectedConversation || !message) return;

  const originalLabel = ui.sendBtn.textContent;
  ui.messageInput.disabled = true;
  ui.sendBtn.disabled = true;
  ui.sendBtn.textContent = "Sending";

  try {
    await apiFetch(CONFIG.sendEndpoint, {
      method: "POST",
      body: JSON.stringify({
        userId: state.myUserId,
        recipientId: state.selectedRecipientId,
        message,
      }),
    });

    ui.messageInput.value = "";
    await loadMessages({ showLoading: false });
  } finally {
    ui.messageInput.disabled = false;
    ui.sendBtn.disabled = false;
    ui.sendBtn.textContent = originalLabel;
    ui.messageInput.focus();
  }
});

ui.sendBtn.addEventListener("click", sendMessage);

ui.messageInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  sendMessage();
});

(async () => {
  state.myUserId = getUserId();
  state.myUsername = getUsername();
  renderAuthState();
  if (!getToken()) return;
  try {
    await connectRealtime();
  } catch {
    resetSession();
  }
})();

window.addEventListener("beforeunload", stopStream);
