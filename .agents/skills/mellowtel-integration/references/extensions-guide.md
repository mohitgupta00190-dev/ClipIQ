# Mellowtel Integration Guide for Browser Extensions

This guide provides instructions for integrating Mellowtel monetization into any browser extension project, regardless of the framework used.

## Overview

Mellowtel is a consensual monetization engine that allows browser extension users to opt-in to share unused internet bandwidth. This guide covers integration for all major extension frameworks and vanilla implementations.

## Prerequisites

- Existing browser extension project
- Mellowtel account and configuration key from https://mellowtel.com

## Step 1: Detect Your Framework

Before starting the integration, identify your extension framework (DO NOT ADD BUILD TOOLS IF THEY DON'T EXIST):

### Detection Methods

1. **Check `package.json` dependencies** (DO NOT INIT NPM IF IT DOESN'T EXIST IN PROJECT):
   - **Plasmo**: Contains `"plasmo": "..."` in dependencies or devDependencies
   - **WXT**: Contains `"wxt": "..."` in dependencies or devDependencies
   - **Vanilla**: No extension framework listed
   - **No package.json**: Use local bundled file instead of npm install

2. **Check for framework-specific files**:
   - **Plasmo**: Has `.plasmo` or uses `plasmo` commands in package.json scripts
   - **WXT**: Has `wxt.config.ts` or `wxt.config.js`
   - **Vanilla**: Has `manifest.json` in root directory

3. **Check project structure**:
   - **Plasmo**: Uses `background.ts`, `content.ts`, `contents/` folder pattern
   - **WXT**: Uses `entrypoints/` folder with `background.ts`, `*.content.ts` files
   - **Vanilla**: Has `src/` or direct `background.js`, `content.js` files with manual manifest.json

### Framework-Specific Guides

Once you've identified the framework:

- **For Plasmo projects**: Follow the detailed guide at `guides/plasmo.md`
- **For WXT projects**: Follow the detailed guide at `guides/wxt.md`
- **For Vanilla/Other frameworks**: Continue with the general instructions below

## General Integration (Vanilla Extensions & Other Frameworks)

### Quick File Summary

**For projects WITH npm/bundler:**
1. **Install package**: `npm install mellowtel`
2. **Modify**: `manifest.json` - Add required permissions + set service_worker `"type": "module"` (MV3)
3. **Create**: `config/mellowtel.js` - Configuration file
4. **Modify**: `background.js` - Add mellowtel initialization
5. **Modify**: `content.js` - Add mellowtel content script initialization
6. **Create/Modify**: `popup.html` + `popup.js` - Add settings button

**For projects WITHOUT npm/bundler:**
1. **Copy**: `mellowtel.js` from this integration-agent project root directory
2. **Modify**: `manifest.json` - Add permissions + set service_worker `"type": "module"` (MV3) + configure script loading order + popup configuration
3. **Modify**: `background.js` - Add mellowtel initialization (using global variable)
4. **Create**: `mellowtel-content.js` - Mellowtel content script (using global variable)
5. **Create/Modify**: `popup.html` + `popup.js` - Add settings button

### 1. Package Installation

**For projects WITH npm/bundler**:

Install mellowtel as a dependency:

```bash
npm install mellowtel
```

**Verification**: Check that `package.json` includes mellowtel in dependencies.

**For projects WITHOUT npm/bundler**:

**⚠️ IMPORTANT**: If your project does NOT have a `package.json` file, DO NOT run `npm init` or create one. Instead, skip this step and go directly to **Section 6: Build Setup > For Projects without Build Tools** to use the local bundled version.

### 2. Manifest Configuration

**File**: `manifest.json` (usually in root or `src/` directory)

**Action**: Add required permissions to the manifest.

#### Manifest V3 (Recommended):

```json
{
  "manifest_version": 3,
  "name": "Your Extension Name",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "declarativeNetRequestWithHostAccess"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"  // REQUIRED: Must be "module" for ES6 imports
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

#### Manifest V2 (Legacy):

```json
{
  "manifest_version": 2,
  "name": "Your Extension Name",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "declarativeNetRequestWithHostAccess",
    "<all_urls>"
  ],
  "background": {
    "scripts": ["background.js"],
    "persistent": true
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

**Important Notes**:
- Always merge with existing permissions, don't replace them
- If `permissions` array exists, append to it
- If `host_permissions` exists (MV3), append to it
- If `content_scripts` array exists, append mellowtel or modify existing
- Use `declarativeNetRequestWithHostAccess` for compatibility across all browsers (Chrome, Firefox, Edge)
- **Manifest V3 REQUIRED**: The service_worker `"type"` field MUST be set to `"module"` for ES6 import support

**Special Case - Existing `declarativeNetRequest` Permission**:
If your extension already has the `declarativeNetRequest` permission (without `WithHostAccess`) keep existing permission: No changes needed - `declarativeNetRequest` works with mellowtel

### 3. Configuration Setup

#### Option A: Configuration File (Recommended)

**Create**: `config/mellowtel.js` (or `src/config/mellowtel.js` based on structure)

```javascript
// Mellowtel configuration
export const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY';

// IMPORTANT: Replace 'TEST_CONFIG_KEY' with the actual user's Mellowtel API key
// This placeholder will be replaced during the integration process
```

**Alternative locations**:
- `src/config/mellowtel.js`
- `js/config/mellowtel.js`
- `lib/mellowtel.js`
- `utils/mellowtel.js`
- Root directory: `mellowtel.config.js`

#### Option B: Inline Configuration

Directly use the configuration key in your background and content scripts (less maintainable but simpler for small projects).

### 4. Background Script Integration

**Note**: If you're using the bundled version (no npm/bundler), skip to **Section 6: Build Setup > For Projects without Build Tools** for bundled-specific instructions.

**Locate background script**:
- Common locations: `background.js`, `src/background.js`, `background/index.js`
- Check your `manifest.json` for the actual location

#### For ES Modules (Modern):

```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js'; // Adjust path as needed

// ... existing imports and code

let mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initBackground();
    console.log('Mellowtel background initialized');
  } catch (error) {
    console.error('Mellowtel initialization failed:', error);
  }
})();

// Handle extension installation/update (check existing handlers first)
// IMPORTANT: Check for existing onInstalled handlers before adding this code:
// 1. Search your service worker/background script for: chrome.runtime.onInstalled.addListener
// 2. If your service worker imports other files, check those files too
// 3. Search for patterns like: onInstalled.addListener, runtime.onInstalled, chrome.runtime.onInstalled
// 4. If existing handlers found, check if they create UI (tabs, windows, popups, notifications)
// 5. If existing handlers create UI: DO NOT add this code (avoid conflicts)
// 6. If existing handlers do NOT create UI: Safe to add this code alongside existing handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);

  if (mellowtel) {
    try {
      // Optional: Generate and open opt-in link for new installations
      await mellowtel.generateAndOpenOptInLink();
    } catch (error) {
      console.error('Failed to generate opt-in link:', error);
    }
  }
});

// ... existing background code
```

#### For CommonJS (Legacy):

```javascript
const Mellowtel = require('mellowtel').default;
const { MELLOWTEL_CONFIG_KEY } = require('./config/mellowtel.js');

// ... existing code

let mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initBackground();
    console.log('Mellowtel background initialized');
  } catch (error) {
    console.error('Mellowtel initialization failed:', error);
  }
})();

// Handle extension installation/update (check existing handlers first)
// IMPORTANT: Check for existing onInstalled handlers before adding this code:
// 1. Search your service worker/background script for: chrome.runtime.onInstalled.addListener
// 2. If your service worker imports other files, check those files too
// 3. Search for patterns like: onInstalled.addListener, runtime.onInstalled, chrome.runtime.onInstalled
// 4. If existing handlers found, check if they create UI (tabs, windows, popups, notifications)
// 5. If existing handlers create UI: DO NOT add this code (avoid conflicts)
// 6. If existing handlers do NOT create UI: Safe to add this code alongside existing handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);

  if (mellowtel) {
    try {
      await mellowtel.generateAndOpenOptInLink();
    } catch (error) {
      console.error('Failed to generate opt-in link:', error);
    }
  }
});

// ... existing background code
```

#### For Inline Configuration:

```javascript
import Mellowtel from 'mellowtel';

const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY'; // This will be replaced with the actual user's API key

let mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initBackground();
    console.log('Mellowtel initialized successfully');
  } catch (error) {
    console.error('Mellowtel initialization failed:', error);
  }
})();
```

**Important**:
- Don't modify existing event handlers
- If you already have `chrome.runtime.onInstalled.addListener`, leave it unchanged
- Add mellowtel initialization at the top or bottom of your background script

### 5. Content Script Integration

**Note**: If you're using the bundled version (no npm/bundler), skip to **Section 6: Build Setup > For Projects without Build Tools** for bundled-specific instructions.

**Locate content script**:
- Common locations: `content.js`, `src/content.js`, `content/index.js`
- Check your `manifest.json` for the actual location

#### Option A: Dedicated Mellowtel Content Script (Recommended)

**Create**: `mellowtel-content.js` (or `src/mellowtel-content.js`)

```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js'; // Adjust path

let mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initContentScript();
    console.log('Mellowtel content script initialized');
  } catch (error) {
    console.error('Mellowtel content script initialization failed:', error);
  }
})();
```

**Update `manifest.json`** to include the new content script:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["mellowtel-content.js"],
      "run_at": "document_start",
      "all_frames": true
    },
    // ... existing content scripts
  ]
}
```

**Why create a separate content script?**:
- Non-invasive: Doesn't modify existing content scripts
- Isolation: Mellowtel initialization is contained
- No conflicts: Avoids issues with existing content script configurations

#### Option B: Add to Existing Content Script

If you prefer to add to an existing content script:

```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js';

// ... existing imports and code

let mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initContentScript();
    console.log('Mellowtel content script initialized');
  } catch (error) {
    console.error('Mellowtel content script initialization failed:', error);
  }
})();

// ... existing content script code
```

**Important**: Ensure your existing content script has `"matches": ["<all_urls>"]` in manifest.json.

### 6. Build Setup

#### For Projects with Build Tools (Webpack, Rollup, Vite, etc.):

Ensure your build configuration:
1. **Bundles mellowtel** with your extension
2. **Handles ES modules** properly
3. **Outputs to correct directories** matching manifest.json

#### .gitignore Setup (Only if node_modules exists)

**Important**: Only add `.gitignore` if your project has a `node_modules` folder.

**Check for node_modules**:
```bash
# Check if node_modules folder exists
ls -la | grep node_modules
# or on Windows:
dir | findstr node_modules
```

**If node_modules exists, create `.gitignore`**:

**File**: `.gitignore` (in project root)

```gitignore
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn-integrity
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.DS_Store
Thumbs.db
```

**If node_modules does NOT exist**: Skip this step entirely - do not create `.gitignore`.

**Example Webpack configuration**:

```javascript
module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    'mellowtel-content': './src/mellowtel-content.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  // ... rest of config
};
```

#### For Projects without Build Tools (No npm/bundler):

**Important**: If your project does not use npm or any bundler (Webpack, Rollup, Vite, etc.), you MUST use the **local Mellowtel bundled file** instead of installing via npm.

This approach is for:
- Pure JavaScript/HTML extensions with no build process
- Extensions that load scripts directly via manifest.json
- Projects without package.json or node_modules
- **DO NOT** run `npm init` to create a package.json - use the local bundled file instead

##### Step 1: Copy Mellowtel Bundled File

1. Copy the bundled file from this project:
   - **Source**: `mellowtel.js` (located in the root of this integration-agent project)
   - **Copy command**: `cp mellowtel.js your-extension-directory/lib/mellowtel.js`
   - **Or manually**: Copy the file from this project's root directory

2. Save this file to your extension directory:
   - Recommended locations: `lib/mellowtel.js`, `vendor/mellowtel.js`, `js/mellowtel.js`, or `scripts/mellowtel.js`
   - Place it where your other extension scripts are located

3. Do NOT modify the copied file - use it as-is

##### Step 2: Update Manifest Configuration

**Important**: The bundled version requires specific loading order and configuration.

**For Manifest V3** (service worker):

```json
{
  "manifest_version": 3,
  "background": {
    "service_worker": "background.js",
    "type": "module"  // REQUIRED: Must be "module" for ES6 imports
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "lib/mellowtel.js",
        "mellowtel-content.js"
      ],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

**For Manifest V2**:

```json
{
  "manifest_version": 2,
  "background": {
    "scripts": [
      "lib/mellowtel.js",
      "background.js"
    ],
    "persistent": true
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "lib/mellowtel.js",
        "mellowtel-content.js"
      ],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

**Critical**:
- `mellowtel.js` **MUST** be loaded **before** your content script
- This ensures the `Mellowtel` global variable is available when your scripts run
- For MV3 background, **REQUIRED**: set `"type": "module"` in the background configuration to enable ES6 imports

##### Step 3: Background Script Integration (Bundled Version)

**File**: `background.js`

```javascript
// Import the bundled mellowtel
import './lib/mellowtel.js';  // Adjust path as needed

// Mellowtel is now available as a global variable
const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY'; // This will be replaced with the actual user's API key

let mellowtel;

(async () => {
  try {
    // Access Mellowtel from global scope
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initBackground();
    console.log('Mellowtel background initialized');
  } catch (error) {
    console.error('Mellowtel initialization failed:', error);
  }
})();

// Handle extension installation/update (check existing handlers first)
// IMPORTANT: Check for existing onInstalled handlers before adding this code:
// 1. Search your service worker/background script for: chrome.runtime.onInstalled.addListener
// 2. If your service worker imports other files, check those files too
// 3. Search for patterns like: onInstalled.addListener, runtime.onInstalled, chrome.runtime.onInstalled
// 4. If existing handlers found, check if they create UI (tabs, windows, popups, notifications)
// 5. If existing handlers create UI: DO NOT add this code (avoid conflicts)
// 6. If existing handlers do NOT create UI: Safe to add this code alongside existing handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed or updated:', details);

  if (mellowtel) {
    try {
      await mellowtel.generateAndOpenOptInLink();
    } catch (error) {
      console.error('Failed to generate opt-in link:', error);
    }
  }
});
```

**For MV2 (no import needed)**:

```javascript
// Mellowtel is already loaded from manifest scripts array
// Access directly as global variable
const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY'; // This will be replaced with the actual user's API key

let mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initBackground();
    console.log('Mellowtel initialized successfully');
  } catch (error) {
    console.error('Mellowtel initialization failed:', error);
  }
})();
```

##### Step 4: Content Script Integration (Bundled Version)

**File**: `mellowtel-content.js`

```javascript
// Mellowtel is available as a global variable from mellowtel.js
// NO NEED TO IMPORT - it's already loaded by the manifest

const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY'; // This will be replaced with the actual user's API key

let mellowtel;

(async () => {
  try {
    // Access Mellowtel from global scope
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initContentScript();
    console.log('Mellowtel content script initialized');
  } catch (error) {
    console.error('Mellowtel content script initialization failed:', error);
  }
})();
```

**Important Notes for Bundled Version**:
- **No imports needed** in content scripts - `Mellowtel` is a global variable
- **Load order matters**: `mellowtel.js` must be listed before your content script in manifest
- **MV3 requires** `"type": "module"` in background configuration
- **MV2 uses** scripts array in background (no module type needed)

## 7. Popup Page Integration

Adding a settings button to your popup provides users easy access to Mellowtel settings. This section covers both creating a new popup and adding to an existing one.

### Check if Popup Exists

First, check your `manifest.json` for an existing popup configuration:

**Manifest V3**:
```json
{
  "action": {
    "default_popup": "popup.html"
  }
}
```

**Manifest V2**:
```json
{
  "browser_action": {
    "default_popup": "popup.html"
  }
}
```

- **If popup exists**: Follow **Option B: Add to Existing Popup**
- **If no popup**: Follow **Option A: Create New Popup**

### Option A: Create New Popup (No Existing Popup)

If your extension doesn't have a popup, create one from scratch.

#### Step 1: Create Popup HTML

**Create**: `popup.html` (or `src/popup.html` based on project structure)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Popup</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 300px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .container {
      text-align: center;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .subtitle {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 24px;
    }

    .settings-button {
      width: 100%;
      padding: 12px 20px;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .settings-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .settings-button:active {
      transform: translateY(0);
    }

    .icon {
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="extension-name">Your Extension</h1>
    <button id="open-settings" class="settings-button">
      <span class="icon">⚙️</span>
      Open Settings Page
    </button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**For projects WITHOUT npm/bundler** (Bundled version):

Import the mellowtel.js script in the HTML **before** popup.js:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Popup</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 300px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .container {
      text-align: center;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .subtitle {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 24px;
    }

    .settings-button {
      width: 100%;
      padding: 12px 20px;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .settings-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .settings-button:active {
      transform: translateY(0);
    }

    .icon {
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 id="extension-name">Your Extension</h1>
    <button id="open-settings" class="settings-button">
      <span class="icon">⚙️</span>
      Open Settings Page
    </button>
  </div>
  <!-- Import mellowtel BEFORE popup.js so it's available as a global -->
  <script src="lib/mellowtel.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

#### Step 2: Create Popup JavaScript

**Create**: `popup.js` (or `src/popup.js`)

**For projects WITH npm/bundler** (ES Modules):

```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js'; // Adjust path

// Set extension name from manifest
chrome.runtime.getManifest().then((manifest) => {
  document.getElementById('extension-name').textContent = manifest.name;
}).catch(() => {
  // Fallback for MV2 or if promise fails
  const manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name;
});

// Initialize Mellowtel and handle settings button
document.getElementById('open-settings').addEventListener('click', async () => {
  try {
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    const settingsUrl = await mellowtel.generateSettingsLink();
    
    // Open settings page in new tab
    chrome.tabs.create({ url: settingsUrl });
  } catch (error) {
    console.error('Failed to open settings:', error);
    alert('Failed to open settings page. Please try again.');
  }
});
```

**For projects WITHOUT npm/bundler** (Bundled version):

**Create**: `popup.js`

```javascript
// Mellowtel is available as a global variable (loaded from lib/mellowtel.js in HTML)
// NO NEED TO IMPORT - it's already loaded by the HTML

const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY'; // This will be replaced with the actual user's API key

// Set extension name from manifest
try {
  const manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name;
} catch (error) {
  console.error('Failed to get manifest:', error);
}

// Initialize Mellowtel and handle settings button
document.getElementById('open-settings').addEventListener('click', async () => {
  try {
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    const settingsUrl = await mellowtel.generateSettingsLink();
    
    // Open settings page in new tab
    chrome.tabs.create({ url: settingsUrl });
  } catch (error) {
    console.error('Failed to open settings:', error);
    alert('Failed to open settings page. Please try again.');
  }
});
```

**Note**: For projects without npm/bundler, `mellowtel.js` is loaded via `<script src="lib/mellowtel.js"></script>` in `popup.html` **before** `popup.js`, making Mellowtel available as a global variable. No special manifest configuration is needed for popup scripts.

#### Step 3: Update Manifest

Add the popup configuration to your `manifest.json`:

**Manifest V3**:
```json
{
  "action": {
    "default_popup": "popup.html",
    "default_title": "Your Extension",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Manifest V2**:
```json
{
  "browser_action": {
    "default_popup": "popup.html",
    "default_title": "Your Extension",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Note**: Adjust icon paths to match your extension's icon locations, or remove the `default_icon` field if you don't have icons yet.

#### Step 4: Build Configuration (if applicable)

If you're using a bundler, ensure `popup.js` is included in your build:

**Example Webpack config**:
```javascript
module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup.js'  // Add popup entry
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  }
};
```

### Option B: Add to Existing Popup

If you already have a popup, add the settings button following your existing design.

#### Step 1: Add Settings Button to HTML

Open your existing `popup.html` and add a settings button. Match the style of your existing UI:

**Example for a popup with existing buttons**:

```html
<!-- Add this button to your existing popup.html -->
<!-- Place it where it makes sense in your UI (top, bottom, or with other buttons) -->

<button id="mellowtel-settings" class="your-existing-button-class">
  <span class="icon">⚙️</span>
  Open Settings Page
</button>

<!-- Or if you have a settings section: -->
<div class="settings-section">
  <!-- Your existing settings items -->
  <button id="mellowtel-settings" class="settings-item">
    <span class="icon">⚙️</span>
    Mellowtel Settings
  </button>
</div>
```

**Styling tips**:
- Use the same CSS classes as your existing buttons
- Match font sizes, colors, and spacing
- Use your extension's color scheme
- Place it in a logical location (e.g., settings section, bottom of popup, etc.)

**Example CSS styles to match your theme**:

```css
/* Add to your existing popup.css or style section */
#mellowtel-settings {
  /* Copy styles from your existing buttons */
  /* Example: */
  padding: 10px 16px;
  background: var(--primary-color);  /* Use your color variables */
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

#mellowtel-settings:hover {
  background: var(--primary-hover-color);
}
```

#### Step 2: Add JavaScript Handler

Open your existing `popup.js` (or popup script file) and add the settings button handler:

**For projects WITH npm/bundler**:

```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js'; // Adjust path

// ... your existing popup code ...

// Add Mellowtel settings button handler
document.getElementById('mellowtel-settings').addEventListener('click', async () => {
  try {
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    const settingsUrl = await mellowtel.generateSettingsLink();
    
    // Open settings page in new tab
    chrome.tabs.create({ url: settingsUrl });
  } catch (error) {
    console.error('Failed to open Mellowtel settings:', error);
  }
});

// ... rest of your existing popup code ...
```

**For projects WITHOUT npm/bundler**:

First, update your `popup.html` to import mellowtel.js **before** popup.js:

```html
<!-- Add this line in your popup.html BEFORE the popup.js script tag -->
<script src="lib/mellowtel.js"></script>
<script src="popup.js"></script>
```

Then in your `popup.js`:

```javascript
// Mellowtel is available as a global variable (loaded from lib/mellowtel.js in HTML)
// NO NEED TO IMPORT - it's already loaded by the HTML

const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY'; // This will be replaced with the actual user's API key

// ... your existing popup code ...

// Add Mellowtel settings button handler
document.getElementById('mellowtel-settings').addEventListener('click', async () => {
  try {
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    const settingsUrl = await mellowtel.generateSettingsLink();
    
    // Open settings page in new tab
    chrome.tabs.create({ url: settingsUrl });
  } catch (error) {
    console.error('Failed to open Mellowtel settings:', error);
  }
});

// ... rest of your existing popup code ...
```

**Alternative: If using event delegation or framework-specific patterns**:

```javascript
// For React components
function PopupComponent() {
  const handleOpenSettings = async () => {
    try {
      const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
      const settingsUrl = await mellowtel.generateSettingsLink();
      chrome.tabs.create({ url: settingsUrl });
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  return (
    // Your existing JSX
    <button onClick={handleOpenSettings}>
      ⚙️ Open Settings Page
    </button>
  );
}

// For Vue components
export default {
  methods: {
    async openSettings() {
      try {
        const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
        const settingsUrl = await mellowtel.generateSettingsLink();
        chrome.tabs.create({ url: settingsUrl });
      } catch (error) {
        console.error('Failed to open settings:', error);
      }
    }
  }
}
```

### Common Popup Patterns

#### Minimal Design (Simple Extensions)

```html
<div class="popup-minimal">
  <h2>Extension Name</h2>
  <button id="mellowtel-settings">Settings</button>
</div>
```

#### List Style (Multiple Options)

```html
<ul class="popup-list">
  <li class="popup-item" id="option-1">Feature 1</li>
  <li class="popup-item" id="option-2">Feature 2</li>
  <li class="popup-item" id="mellowtel-settings">
    <span class="icon">⚙️</span>
    Settings
  </li>
</ul>
```

#### Card Style (Modern Design)

```html
<div class="popup-card">
  <div class="card-header">
    <h1>Extension Name</h1>
  </div>
  <div class="card-body">
    <!-- Your existing content -->
  </div>
  <div class="card-footer">
    <button id="mellowtel-settings" class="btn-secondary">
      Open Settings
    </button>
  </div>
</div>
```

## Validation Steps

### 1. Check Installation

```bash
# Verify mellowtel is installed
npm list mellowtel

# Should show: mellowtel@x.x.x
```

### 2. Build Validation

```bash
# Build your extension
npm run build  # or your build command

# Check manifest.json has required permissions
cat dist/manifest.json  # adjust path to your output directory
```

**Expected manifest contents**:
```json
{
  "permissions": ["storage", "declarativeNetRequestWithHostAccess"],
  "host_permissions": ["<all_urls>"]  // or in permissions for MV2
}
```

**Or if you already have declarativeNetRequest**:
```json
{
  "permissions": ["storage", "declarativeNetRequest"],
  "host_permissions": ["<all_urls>"]  // or in permissions for MV2
}
```

## Error Handling and Troubleshooting

### Common Issues

#### 1. Module Resolution Errors

**Error**: `Cannot find module 'mellowtel'`

**Solutions**:
- Verify installation: `npm install mellowtel`
- Check your bundler configuration includes node_modules
- Ensure build process is running correctly

#### 2. Import Path Errors

**Error**: `Cannot resolve './config/mellowtel.js'`

**Solutions**:
```javascript
// Try different relative paths
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js';
import { MELLOWTEL_CONFIG_KEY } from '../config/mellowtel.js';
import { MELLOWTEL_CONFIG_KEY } from '../../config/mellowtel.js';

// Or use inline configuration (key will be replaced during integration)
const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY';
```

#### 3. Permissions Errors

**Error**: `Required permission 'declarativeNetRequestWithHostAccess' is not in manifest`

**Solution**: Verify manifest.json includes one of these permission configurations:

**Option 1 - Using declarativeNetRequestWithHostAccess (recommended)**:
```json
{
  "permissions": ["storage", "declarativeNetRequestWithHostAccess"],
  "host_permissions": ["<all_urls>"]
}
```

**Option 2 - If you already have declarativeNetRequest**:
```json
{
  "permissions": ["storage", "declarativeNetRequest"],
  "host_permissions": ["<all_urls>"]
}
```

**Note**: If your extension already has `declarativeNetRequest` permission, you don't need to change it - mellowtel works with both `declarativeNetRequest` and `declarativeNetRequestWithHostAccess`.

#### 4. Content Script Not Running

**Error**: No mellowtel content script logs in console

**Solutions**:
- Check manifest.json has content_scripts with `"matches": ["<all_urls>"]`
- Verify `"all_frames": true` and `"run_at": "document_start"`
- Ensure content script file is included in build output
- Check browser console for script loading errors

#### 5. Existing Event Handlers

**Critical Check**: Before adding `chrome.runtime.onInstalled` handler, thoroughly check for existing handlers:

**Step 1: Check Main Service Worker/Background Script**
Search your main background script for these patterns:
```javascript
// Search for these exact patterns:
chrome.runtime.onInstalled.addListener
runtime.onInstalled.addListener
onInstalled.addListener
chrome.runtime.onInstalled =
```

**Step 2: Check All Imported Files**
If your service worker imports other files, check each imported file:
```javascript
// Example: if your background.js has:
import './utils/setup.js';
import './handlers/events.js';
import { initializeApp } from './app/init.js';

// Then check: utils/setup.js, handlers/events.js, app/init.js
// Search each file for the same onInstalled patterns
```

**Step 3: Check for Dynamic Imports**
Look for dynamic imports that might contain handlers:
```javascript
// Check files loaded via:
import('./modules/handlers.js');
await import('./setup.js');
```

**Decision Rules**:
- **If NO existing handlers found**: You can safely add mellowtel's onInstalled handler
- **If existing handlers found**: Check if they create UI (new tabs, popups, etc.)
  - **If existing handlers create UI**: **DO NOT** add mellowtel's handler (avoid UI conflicts)
  - **If existing handlers do NOT create UI**: You can safely add mellowtel's handler alongside existing ones
- **Never modify** existing handlers - keep mellowtel code completely separate

**Step 4: Check if Existing Handlers Create UI**
If you found existing `onInstalled` handlers, examine their code for UI creation:
```javascript
// UI-creating patterns to look for:
chrome.tabs.create()           // Creates new tab
chrome.tabs.update()           // Updates/navigates tab
chrome.windows.create()        // Creates new window
chrome.action.openPopup()      // Opens popup
chrome.notifications.create()  // Shows notifications
window.open()                  // Opens new window/tab
chrome.runtime.openOptionsPage() // Opens extension options page

// Examples of UI-creating handlers (DO NOT add mellowtel handler):
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: 'welcome.html' }); // Creates UI - conflict risk
});

// Examples of non-UI handlers (SAFE to add mellowtel handler):
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');     // No UI - safe
  chrome.storage.local.set({version: 1}); // No UI - safe
});
```

**Common File Locations to Check**:
- `background.js`, `background/index.js`
- `src/background.js`, `src/background/index.js`
- `utils/`, `handlers/`, `events/`, `setup/`, `js/` folders
- Any file imported in your service worker

### Edge Cases

#### 1. TypeScript Projects

For TypeScript projects, create `config/mellowtel.ts`:

```typescript
// Mellowtel configuration
export const MELLOWTEL_CONFIG_KEY: string = 'TEST_CONFIG_KEY';

// IMPORTANT: Replace 'TEST_CONFIG_KEY' with the actual user's Mellowtel API key
// This placeholder will be replaced during the integration process
```

And use in scripts:

```typescript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel';

let mellowtel: Mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initBackground();
  } catch (error) {
    console.error('Mellowtel initialization failed:', error);
  }
})();
```

#### 2. Multiple Content Scripts

If you have multiple content scripts, mellowtel should be in a separate one:

```json
{
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["existing-content.js"]
    },
    {
      "matches": ["<all_urls>"],
      "js": ["mellowtel-content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ]
}
```

#### 3. Browser-Specific Builds

For all browser targets, use the same manifest configuration:

**Chrome/Firefox/Edge** (All browsers):
```json
{
  "permissions": ["storage", "declarativeNetRequestWithHostAccess"],
  "host_permissions": ["<all_urls>"]
}
```

**Or if you already have declarativeNetRequest**:
```json
{
  "permissions": ["storage", "declarativeNetRequest"],
  "host_permissions": ["<all_urls>"]
}
```

**Note**: Both `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` are compatible with all major browsers. If your extension already has `declarativeNetRequest`, you don't need to change it.

**Safari**:
Similar configuration, but may need additional Safari-specific setup.

#### 4. Webpack/Bundler Configuration

Ensure mellowtel is bundled correctly:

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    extensions: ['.js', '.ts'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules(?!\/mellowtel)/,
        use: 'babel-loader'
      }
    ]
  }
};
```

## Important File Management Warning

**⚠️ CRITICAL: DO NOT add markdown (.md) files to your extension folder after integration**

- **Never add**: README.md, CHANGELOG.md, documentation files, or any .md files to your extension directory
- **Why**: Markdown files can interfere with extension packaging and store submission
- **Extension stores**: Chrome Web Store and other stores may reject extensions with unnecessary documentation files

---

**Important Notes**:

- This integration maintains all existing extension functionality
- Mellowtel operates independently of your extension's core features
- The process is designed to be non-invasive
