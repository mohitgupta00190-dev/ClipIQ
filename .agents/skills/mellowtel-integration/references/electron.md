# Mellowtel Integration Guide for Electron Apps

This guide provides step-by-step instructions for integrating Mellowtel monetization into any Electron application using the private npm package.

## Overview

Mellowtel is a consensual monetization engine for Electron applications. This guide covers integration using the private @mellowtel-inc/mellowtel-electron package from GitHub Packages.

## Prerequisites

- Existing Electron project
- Mellowtel API key from https://mellowtel.com
- Access to the private @mellowtel-inc/mellowtel-electron package

## Quick File Summary

1. **Copy**: `.npmrc` file from integration-agent root to Electron app root
2. **Install**: `@mellowtel-inc/mellowtel-electron` package
3. **Create/Modify**: `preload.js` - Add IPC communication for Mellowtel
4. **Modify**: `main.js` (or main process file) - Add Mellowtel initialization and IPC handlers
5. **Create/Modify**: Renderer UI - Add settings page with support toggle

## Step 1: Configure Private Package Access

**Action**: Copy the `.npmrc` file from the integration-agent project root to your Electron app root directory.

**Source**: `integration-agent/.npmrc`
**Destination**: `your-electron-app/.npmrc`

**Important**: 
- The `.npmrc` file must be in the root directory of your Electron app

## Step 2: Install Mellowtel Package

**Action**: Install the private Mellowtel Electron package.

```bash
# Install the package
npm install @mellowtel-inc/mellowtel-electron
```

**Verification**: Check that `package.json` includes:
```json
{
  "dependencies": {
    "@mellowtel-inc/mellowtel-electron": "^x.x.x"
  }
}
```

## Step 3: Create or Update Preload File

**Locate preload file**:
- Common locations: `preload.js`, `src/preload.js`, `app/preload.js`
- Check your main process file for `preload` configuration
- If no preload file exists, create `preload.js` in your project root or `src/` directory

### Option A: Update Existing Preload File

If you already have a preload file with `contextBridge.exposeInMainWorld`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing code (keep all existing functions)

  // Mellowtel support operations
  isOptedIn: () => ipcRenderer.invoke('mellowtel:isOptedIn'),
  toggleSupport: () => ipcRenderer.invoke('mellowtel:toggleSupport'),
});
```

**Important**: 
- Keep ALL existing functions in `electronAPI`
- Only add the two new Mellowtel functions
- Don't modify or remove any existing code

### Option B: Create New Preload File

If you don't have a preload file yet:

**Create**: `preload.js` (or `src/preload.js`)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Mellowtel support operations
  isOptedIn: () => ipcRenderer.invoke('mellowtel:isOptedIn'),
  toggleSupport: () => ipcRenderer.invoke('mellowtel:toggleSupport'),
});
```

**Update Main Process**: If you created a new preload file, you need to reference it in your main process file when creating the BrowserWindow:

```javascript
const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'), // Adjust path as needed
    contextIsolation: true,
    nodeIntegration: false
  }
});
```

## Step 4: Update Main Process File

**Locate main process file**:
- Common locations: `main.js`, `index.js`, `src/main.js`, `app/main.js`
- Usually defined in `package.json` under `"main"` field
- Check for `app.whenReady()` or `new BrowserWindow()` calls

**File**: `main.js` (or your main process file)

### Add Mellowtel Import and Configuration

Add at the top of your main process file, after existing imports:

```javascript
// ... existing imports
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import Mellowtel package
const Mellowtel = require('@mellowtel-inc/mellowtel-electron');

// Mellowtel configuration
const MELLOWTEL_API_KEY = 'YOUR_API_KEY'; // Replace with actual API key
let mellowtel = null;

// ... rest of existing code
```

**Important**: Replace `'YOUR_API_KEY'` with your actual Mellowtel API key from https://mellowtel.com

### Add IPC Handlers Function

Add this function before `app.whenReady()`:

```javascript
const setupIpcHandlers = () => {
  // Mellowtel support operations
  ipcMain.handle('mellowtel:isOptedIn', () => {
    if (!mellowtel) return false;
    return mellowtel.getOptInStatus();
  });

  ipcMain.handle('mellowtel:toggleSupport', async () => {
    if (!mellowtel) return;

    const currentStatus = mellowtel.getOptInStatus();
    if (currentStatus) {
      await mellowtel.optOut();
    } else {
      await mellowtel.optIn();
      // When opting back in, we need to reinitialize to re-establish connection
      mellowtel.init();
    }
  });
};
```

### Initialize Mellowtel in app.whenReady()

Modify your existing `app.whenReady()` to include Mellowtel initialization:

```javascript
app.whenReady().then(() => {
  // Setup IPC handlers first
  setupIpcHandlers();

  // Initialize Mellowtel
  mellowtel = new Mellowtel.default(MELLOWTEL_API_KEY, {
    disableLogs: false, // Set to true in production
  });

  // ... existing code (createWindow, etc.)

  // Start Mellowtel if user has opted in
  if (mellowtel.getOptInStatus()) {
    mellowtel.init();
  }
});
```

**Alternative: If you have a separate createWindow function**:

```javascript
function createWindow() {
  // ... existing BrowserWindow creation code

  // Your existing window creation logic
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // ... existing code
}

app.whenReady().then(() => {
  setupIpcHandlers();

  mellowtel = new Mellowtel.default(MELLOWTEL_API_KEY, {
    disableLogs: false,
  });

  createWindow();

  // ... existing code (macOS app.activate handler, etc.)

  if (mellowtel.getOptInStatus()) {
    mellowtel.init();
  }
});
```

**Important**:
- Don't modify any existing `app.whenReady()` code
- Only add the three new sections: setupIpcHandlers(), mellowtel initialization, and init check
- Keep all existing window creation and app setup code unchanged

## Step 5: Update Renderer UI

**Goal**: Add a settings page with a "Support Developer" toggle that follows your app's theme.

**Locate renderer files**:
- Common locations: `renderer.js`, `index.html`, `src/renderer/`, `app/renderer/`
- Look for HTML and JavaScript files that handle your app's UI
- Update UI according to framework
- Use window.electronAPI to call IPC functions to check or update status

### Styling Tips

**Match your app's theme**:
- Use your app's color scheme for the toggle switch
- Match font families and sizes
- Use consistent border radius and shadows
- Follow your existing button and card styles
- Use modal if exists in app

**Important Notes**:

- DO NOT CREATE MD FILES
- This integration maintains all existing app functionality
- Mellowtel operates independently of your app's core features
- Users must explicitly opt-in through the settings toggle
- The integration is completely non-invasive to existing code

