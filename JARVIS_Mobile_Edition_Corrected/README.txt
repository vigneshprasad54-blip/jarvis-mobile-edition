J.A.R.V.I.S. Mobile Edition

Files:
- index.html
- style.css
- script.js

How to run:
1. Put all 3 files in the same folder.
2. Open index.html in a browser.
3. The first time you send a message, a popup asks for your Gemini API key.
4. The key is stored in this browser's localStorage as "jarvis_key".
5. Text chat uses Gemini generateContent.
6. The microphone button uses the browser's SpeechRecognition API.
7. Text-to-speech uses the browser's speechSynthesis API.

Important:
Client-side API keys can be exposed to anyone who can inspect the page. This is suitable for local/testing use, not a secure public production deployment. For production, put the Gemini API call behind your own backend and never ship the API key in browser JavaScript.
