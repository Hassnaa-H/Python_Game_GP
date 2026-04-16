// Chat UI behaviour: send user messages and fetch replies
(function () {
	const HF_SPACE_URL = 'https://mokhtar68-kids-chat.hf.space/chat';
	const chatHistory = []; // keep previous messages/responses as `{role, content}` objects
	const CONTENT_JSON = 'chatbot-content.json';
	let content = null;

	const chatCard = document.querySelector('.chat-card');
	const input = document.querySelector('.input-area input');
	const sendBtn = document.querySelector('.send-btn');
	const prompts = Array.from(document.querySelectorAll('.prompts button'));
	const placeholder = document.querySelector('.placeholder');
	const attachBtn = document.querySelector('.actions .icon-btn[aria-label="Attach"]');
	const emojiBtn = document.querySelector('.actions .icon-btn[aria-label="Emoji"]');
	const fileInput = document.getElementById('file-input');
  
	// Initialize attachment handling (once)
	if (attachBtn && fileInput) {
		attachBtn.addEventListener('click', () => fileInput.click());
		fileInput.addEventListener('change', (e) => {
			const file = e.target.files && e.target.files[0];
			if (!file) return;
			// show preview as user message
			const node = createUserFileMessage(file);
			insertBeforeBottom(node);
			// append marker into input so user can send context with file
			input.value = (input.value ? input.value + ' ' : '') + `[attached:${file.name}]`;
			// reset file input so same file can be reselected later
			fileInput.value = '';
		});
	}

	// Initialize emoji picker (once)
	if (emojiBtn) {
		let picker = null;
		const EMOJIS = ['😀','😃','😄','😁','😆','😊','😉','😍','😘','😜','🤔','🤨','😅','🙃','🤗','😇','👍','👎','👏','🙏','🔥','🌟','✨','🎉','💡','❓','✅','📎'];
		emojiBtn.addEventListener('click', (e) => {
			// toggle
			const container = document.querySelector('.input-area');
			if (!picker) {
				picker = document.createElement('div');
				picker.className = 'emoji-picker';
				EMOJIS.forEach((em) => {
					const b = document.createElement('button');
					b.type = 'button';
					b.textContent = em;
					b.addEventListener('click', () => {
						// insert emoji at cursor (append for simplicity)
						input.value = input.value + em;
						input.focus();
					});
					picker.appendChild(b);
				});
				container.appendChild(picker);
			} else {
				// remove picker
				picker.remove();
				picker = null;
			}
		});
		// click outside to close picker
		document.addEventListener('click', (ev) => {
			const target = ev.target;
			const isInside = target.closest && (target.closest('.emoji-picker') || target.closest('[aria-label="Emoji"]'));
			if (!isInside) {
				const existing = document.querySelector('.emoji-picker');
				if (existing) existing.remove();
			}
		});
	}

	function createBotMessage(text) {
		const wrapper = document.createElement('div');
		wrapper.className = 'message';

		const avatar = document.createElement('div');
		avatar.className = 'msg-avatar';
		avatar.innerHTML = '<img src="assets/chatbot/image 11.png" alt="Bot" style="width:28px;height:28px;object-fit:cover;border-radius:50%;" />';

		const bubble = document.createElement('div');
		bubble.className = 'bubble ai-bubble';
		bubble.innerHTML = text;

		wrapper.appendChild(avatar);
		wrapper.appendChild(bubble);
		return wrapper;
	}

	function createUserMessage(text) {
		const wrapper = document.createElement('div');
		wrapper.className = 'message user';

		const userWrap = document.createElement('div');
		userWrap.className = 'user-bubble-wrap';
		const userBubble = document.createElement('div');
		userBubble.className = 'user-bubble';
		userBubble.textContent = text;
		const side = document.createElement('div');
		side.className = 'user-side-bar';
		userWrap.appendChild(userBubble);
		userWrap.appendChild(side);

		const avatar = document.createElement('div');
		avatar.className = 'user-avatar';
		avatar.innerHTML = '<img src="assets/chatbot/image 11 (1).png" alt="User" style="width:28px;height:28px;object-fit:cover;border-radius:50%;" />';

		wrapper.appendChild(userWrap);
		wrapper.appendChild(avatar);
		return wrapper;
	}

	function createUserFileMessage(file) {
		const wrapper = document.createElement('div');
		wrapper.className = 'message user';

		const userWrap = document.createElement('div');
		userWrap.className = 'user-bubble-wrap';
		const userBubble = document.createElement('div');
		userBubble.className = 'user-bubble';
		// if image, show thumbnail
		if (file.type && file.type.startsWith('image/')) {
			const img = document.createElement('img');
			img.src = URL.createObjectURL(file);
			img.style.maxWidth = '180px';
			img.style.borderRadius = '8px';
			img.onload = () => URL.revokeObjectURL(img.src);
			userBubble.appendChild(img);
			const name = document.createElement('div');
			name.style.fontSize = '11px';
			name.style.marginTop = '6px';
			name.textContent = file.name;
			userBubble.appendChild(name);
		} else {
			userBubble.textContent = file.name;
		}

		const side = document.createElement('div');
		side.className = 'user-side-bar';
		userWrap.appendChild(userBubble);
		userWrap.appendChild(side);

		const avatar = document.createElement('div');
		avatar.className = 'user-avatar';
		avatar.innerHTML = '<img src="assets/chatbot/image 11 (1).png" alt="User" style="width:28px;height:28px;object-fit:cover;border-radius:50%;" />';

		wrapper.appendChild(userWrap);
		wrapper.appendChild(avatar);
		return wrapper;
	}

	function insertBeforeBottom(node) {
		const messages = chatCard.querySelector('.messages');
		const bottom = chatCard.querySelector('.chat-bottom');
		if (messages) {
			// append into messages container
			messages.appendChild(node);
			// smooth scroll to bottom
			messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
		} else if (bottom) {
			chatCard.insertBefore(node, bottom);
			node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		} else {
			chatCard.appendChild(node);
			node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function setLoadingBotBubble() {
		const loading = createBotMessage('<em>Thinking...</em>');
		loading.dataset.loading = 'true';
		insertBeforeBottom(loading);
		return loading;
	}

	function applyContentToUI(cfg) {
		// welcome message
		try {
			if (cfg && cfg.welcome) {
				// find first ai bubble and replace text
				const firstAi = chatCard.querySelector('.ai-bubble');
				if (firstAi) {
					firstAi.innerHTML = `<strong>${cfg.welcome.title}</strong><p>${cfg.welcome.text}</p>`;
				}
			}

			// prompts: recreate buttons based on content.prompts
			const promptsWrap = chatCard.querySelector('.prompts');
			if (promptsWrap && cfg && Array.isArray(cfg.prompts)) {
				promptsWrap.innerHTML = '';
				cfg.prompts.forEach((p) => {
					const btn = document.createElement('button');
					btn.type = 'button';
					btn.dataset.message = p.message;
					btn.dataset.flowId = p.id || '';
					btn.innerHTML = p.label;
					promptsWrap.appendChild(btn);
				});
				// rebind prompts variable behavior: attach listeners
				const newPrompts = Array.from(promptsWrap.querySelectorAll('button'));
				newPrompts.forEach((btn) => {
					btn.addEventListener('click', () => {
						const val = btn.dataset.message || btn.textContent.trim();
						const flowId = btn.dataset.flowId;
						// if a local flow exists for this id, render it first
						if (flowId && cfg.flows && Array.isArray(cfg.flows[flowId])) {
							cfg.flows[flowId].forEach((m) => {
								if (m.role === 'bot') {
									const node = createBotMessage(m.content);
									insertBeforeBottom(node);
									chatHistory.push({ role: 'bot', content: m.content });
								}
							});
						}
						input.value = val;
						handleSend(val);
					});
				});
			}
		} catch (e) {
			// ignore content application errors
			console.warn('applyContentToUI error', e);
		}
	}

	async function loadContent() {
		try {
			const res = await fetch(CONTENT_JSON);
			if (!res.ok) return null;
			const json = await res.json();
			content = json;
			applyContentToUI(content);
			return json;
		} catch (e) {
			console.warn('Failed to load content JSON', e);
			return null;
		}
	}

	async function sendToSpace(text) {
		try {
			const res = await fetch(HF_SPACE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: chatHistory }),
			});

			const textRes = await res.text();
			// Try to parse JSON; if server returned HTML (e.g., site page), show a helpful error
			try {
				const json = JSON.parse(textRes);
				if (!res.ok) {
					return 'Error: ' + (json.error || JSON.stringify(json));
				}
				// expected { reply: '...' }
				if (json && typeof json.reply !== 'undefined') return json.reply;
				// fallback: return any data we find
				if (json && json.data) return String(json.data);
				return JSON.stringify(json);
			} catch (parseErr) {
				// response wasn't JSON (likely HTML) — return a short snippet
				const snippet = textRes.replace(/\s+/g, ' ').slice(0, 300);
				return 'Error: expected JSON but received non-JSON response: ' + snippet;
			}
		} catch (err) {
			return 'Error: ' + (err.message || String(err));
		}
	}

	async function handleSend(raw) {
		const text = (raw || '').trim();
		if (!text) return;

		if (placeholder) placeholder.remove();
		const userNode = createUserMessage(text);
		insertBeforeBottom(userNode);

		input.value = '';
		input.disabled = true;
		sendBtn.disabled = true;

		const loadingNode = setLoadingBotBubble();
		const reply = await sendToSpace(text);

		loadingNode.remove();

		// If reply looks like an error string, show it as the bot reply
		const botNode = createBotMessage(reply);
		insertBeforeBottom(botNode);

		// store conversation in frontend history: add user then bot
		try {
			chatHistory.push({ role: 'user', content: text });
			chatHistory.push({ role: 'bot', content: reply });
		} catch (e) {
			// ignore history errors
		}

        

		input.disabled = false;
		sendBtn.disabled = false;
		input.focus();
	}

	sendBtn.addEventListener('click', () => handleSend(input.value));
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend(input.value);
		}
	});

	prompts.forEach((btn) => {
		btn.addEventListener('click', () => {
			const val = btn.textContent.trim();
			// Fill input and send directly for quick prompts
			input.value = val;
			handleSend(val);
		});
	});

	// Accessibility: focus input on load
	window.addEventListener('load', () => {
		if (input) input.focus();
		// load content file and apply UI changes
		loadContent();
	});

	// Toggle sidebar when clicking the top-left icon (nine-dots)
	try {
		const iconBtn = document.querySelector('.icon-button');
		const sidebar = document.getElementById('sidebar');
		if (iconBtn && sidebar) {
			iconBtn.addEventListener('click', () => {
				const visible = sidebar.style.display !== 'none';
				sidebar.style.display = visible ? 'none' : 'flex';
			});
		}
	} catch (e) {
		/* ignore */
	}

	// --- Sidebar button actions ---
	try {
		const sidebarEl = document.getElementById('sidebar');
		function clearChat() {
			const messages = chatCard.querySelector('.messages');
			if (messages) messages.innerHTML = '';
			chatHistory.length = 0; // clear history
			// re-add welcome
			if (content && content.welcome) {
				const w = createBotMessage(`<strong>${content.welcome.title}</strong><p>${content.welcome.text}</p>`);
				insertBeforeBottom(w);
			}
		}

		function saveChat(name) {
			try {
				if (!name) name = new Date().toLocaleString();
				const stored = JSON.parse(localStorage.getItem('savedChats') || '[]');
				stored.push({ name, history: chatHistory.slice(), ts: Date.now() });
				localStorage.setItem('savedChats', JSON.stringify(stored));
				return true;
			} catch (e) { return false; }
		}

		function renderSavedList() {
			const stored = JSON.parse(localStorage.getItem('savedChats') || '[]');
			const container = document.createElement('div');
			container.className = 'recent-list';
			container.style.display = 'flex';
			container.style.flexDirection = 'column';
			container.style.gap = '8px';
			container.style.padding = '10px';

			if (!stored.length) {
				const p = document.createElement('div');
				p.textContent = 'No saved chats';
				container.appendChild(p);
			}

			stored.slice().reverse().forEach((c, idx) => {
				const item = document.createElement('button');
				item.type = 'button';
				item.textContent = `${c.name} — ${new Date(c.ts).toLocaleString()}`;
				item.style.textAlign = 'left';
				item.style.padding = '8px';
				item.style.borderRadius = '8px';
				item.style.border = '1px solid rgba(0,0,0,0.06)';
				item.addEventListener('click', () => {
					// load chat
					loadChat(c);
				});
				container.appendChild(item);
			});

			// replace sidebar content temporarily
			sidebarEl._backup = sidebarEl.innerHTML;
			sidebarEl.innerHTML = '';
			const back = document.createElement('button');
			back.type = 'button';
			back.textContent = '← Back';
			back.className = 'menu-btn';
			back.addEventListener('click', () => { sidebarEl.innerHTML = sidebarEl._backup; bindSidebarButtons(); });
			sidebarEl.appendChild(back);
			sidebarEl.appendChild(container);
		}

		function loadChat(saved) {
			try {
				clearChat();
				if (saved && Array.isArray(saved.history)) {
					saved.history.forEach((m) => {
						if (m.role === 'user') insertBeforeBottom(createUserMessage(m.content));
						else insertBeforeBottom(createBotMessage(m.content));
					});
					// restore history
					chatHistory.length = 0;
					saved.history.forEach((h) => chatHistory.push(h));
				}
				// close sidebar
				if (sidebarEl) sidebarEl.style.display = 'none';
			} catch (e) { console.warn('loadChat', e); }
		}

		function quickAction(prefix, promptText) {
			const text = window.prompt(promptText || 'Enter text');
			if (!text) return;
			const payload = `${prefix} ${text}`.trim();
			// send as a normal message
			input.value = payload;
			handleSend(payload);
		}

		function bindSidebarButtons() {
			if (!sidebarEl) return;
			const newBtn = sidebarEl.querySelector('[data-action="new"]');
			const recentBtn = sidebarEl.querySelector('[data-action="recent"]');
			const rephraseBtn = sidebarEl.querySelector('[data-action="rephrase"]');
			const fixBtn = sidebarEl.querySelector('[data-action="fixcode"]');
			const sampleBtn = sidebarEl.querySelector('[data-action="sample"]');

			if (newBtn) newBtn.addEventListener('click', () => {
				if (chatHistory.length) {
					const save = window.confirm('Save current chat before starting a new one?');
					if (save) {
						const name = window.prompt('Save name (optional)');
						saveChat(name || ('Chat ' + new Date().toLocaleString()));
						alert('Saved');
					}
				}
				clearChat();
			});

			if (recentBtn) recentBtn.addEventListener('click', () => renderSavedList());
			if (rephraseBtn) rephraseBtn.addEventListener('click', () => quickAction('Rephrase:', 'Text to rephrase:'));
			if (fixBtn) fixBtn.addEventListener('click', () => quickAction('Find bug in code:', 'Paste code to analyze:'));
			if (sampleBtn) sampleBtn.addEventListener('click', () => quickAction('Write sample copy for:', 'Topic or product:'));
		}

		bindSidebarButtons();
	} catch (e) {
		console.warn('sidebar actions init', e);
	}
})();
