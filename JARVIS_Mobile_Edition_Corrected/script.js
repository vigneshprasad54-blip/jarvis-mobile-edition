// J.A.R.V.I.S. Mobile Edition
// Gemini API key is requested in a browser prompt and stored only in localStorage.
// IMPORTANT: For a public website, do not put a real API key in client-side code.
// Use a backend/proxy for production.

"use strict";

const API_KEY_STORAGE = "jarvis_key";
const MODELS = ["gemini-3.6-flash", "gemini-flash-latest"];

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");

let API_KEY = localStorage.getItem(API_KEY_STORAGE) || "";
let voices = [];
let recognition = null;
let isListening = false;

function getApiKey() {
    if (API_KEY) return API_KEY.trim();
    const key = window.prompt("Enter your Gemini API Key:");
    if (key && key.trim()) {
        API_KEY = key.trim();
        localStorage.setItem(API_KEY_STORAGE, API_KEY);
        return API_KEY;
    }
    return "";
}

function add(text, who) {
    if (!chat) return;
    const d = document.createElement("div");
    d.className = "msg " + who;
    d.innerText = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
    return d;
}

function removeThinking() {
    if (!chat) return;
    const nodes = chat.querySelectorAll(".msg.ai");
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].dataset.thinking === "true") {
            nodes[i].remove();
            break;
        }
    }
}

async function callGemini(prompt) {
    const key = getApiKey();
    if (!key) throw new Error("Gemini API Key is missing.");

    let lastError = null;

    for (const model of MODELS) {
        try {
            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                encodeURIComponent(model) +
                ":generateContent?key=" +
                encodeURIComponent(key);

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{
                            text:
                                "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
                                "Answer clearly and naturally. Keep normal answers concise. " +
                                "The user may use Telugu, English, or mixed Telugu-English. " +
                                "Understand the meaning and reply in the user's language/style."
                        }]
                    },
                    contents: [{
                        role: "user",
                        parts: [{ text: String(prompt) }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024
                    }
                })
            });

            let data = {};
            try { data = await res.json(); }
            catch (_) { throw new Error("Invalid response from Gemini."); }

            if (!res.ok || data.error) {
                lastError = new Error(
                    data?.error?.message || `HTTP ${res.status}: ${res.statusText}`
                );
                const status = data?.error?.status || "";
                if (
                    res.status === 400 ||
                    res.status === 404 ||
                    res.status === 429 ||
                    res.status === 500 ||
                    res.status === 502 ||
                    res.status === 503 ||
                    status === "RESOURCE_EXHAUSTED" ||
                    status === "UNAVAILABLE" ||
                    status === "NOT_FOUND"
                ) continue;
                throw lastError;
            }

            const text = data?.candidates?.[0]?.content?.parts
                ?.map(p => p.text || "")
                .join("")
                .trim();

            if (!text) {
                const blockReason = data?.promptFeedback?.blockReason;
                throw new Error(blockReason
                    ? `Gemini blocked the prompt: ${blockReason}`
                    : "Gemini returned an empty response.");
            }
            return text;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error("Gemini request failed.");
}

async function askGemini(prompt) {
    const thinking = add("J.A.R.V.I.S: Thinking...", "ai");
    if (thinking) thinking.dataset.thinking = "true";

    if (sendBtn) sendBtn.disabled = true;

    try {
        const reply = await callGemini(prompt);
        removeThinking();
        add("J.A.R.V.I.S: " + reply, "ai");
        speak(reply);
    } catch (err) {
        removeThinking();
        add("J.A.R.V.I.S ERROR: " + (err?.message || String(err)), "ai");
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function sendMessage() {
    const t = input ? input.value.trim() : "";
    if (!t) return;
    add("YOU: " + t, "user");
    input.value = "";
    askGemini(t);
}

function loadVoices() {
    if ("speechSynthesis" in window) voices = speechSynthesis.getVoices() || [];
}
loadVoices();
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = loadVoices;

function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 0.85;
    const preferred =
        voices.find(v => /^en-IN$/i.test(v.lang)) ||
        voices.find(v => /^en-US$/i.test(v.lang)) ||
        voices.find(v => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    speechSynthesis.speak(u);
}

function setupSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !micBtn) {
        if (micBtn) micBtn.title = "Speech recognition is not supported in this browser";
        return;
    }

    recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        micBtn.innerText = "LISTENING...";
        micBtn.classList.add("listening");
    };

    recognition.onresult = (e) => {
        const t = e?.results?.[0]?.[0]?.transcript?.trim();
        if (t) {
            if (input) input.value = t;
            add("YOU: " + t, "user");
            askGemini(t);
        }
    };

    recognition.onerror = (e) => {
        const msg = e?.error === "not-allowed"
            ? "Microphone permission was denied. Allow microphone permission and try again."
            : "Microphone error - " + (e?.error || "unknown");
        add("J.A.R.V.I.S: " + msg, "ai");
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.innerText = "🎤";
        micBtn.classList.remove("listening");
    };

    micBtn.onclick = () => {
        if (isListening) {
            try { recognition.stop(); } catch (_) {}
            return;
        }
        try {
            recognition.start();
        } catch (err) {
            console.log("Recognition start:", err);
        }
    };
}

if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (input) {
    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

setupSpeechRecognition();
