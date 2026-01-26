# Project-Specific AI Rules

## 1. Clean Workspace Policy
- Do not create temporary, debug, or log files in the root directory or source folders.
- Always use the 'tmp/' directory for any temporary artifacts (e.g., debug screenshots, logs).
- Ensure 'tmp/' is in .gitignore.

## 2. Server & Port Etiquette
- Port 3000 is reserved for the USER's development server.
- If the AI needs to run a background server for testing or API calls, use port 3001 or higher (e.g., PORT=3001 npm run dev).
- Always terminate background server processes once the task is complete.

## 3. Communication
- Respond to the user in Korean (Standard).
