# Mellowtel Integration Guide for WXT Extensions

This guide provides step-by-step instructions for integrating mellowtel monetization into any WXT browser extension project, regardless of the template or existing structure.

## Overview

Mellowtel is a consensual monetization engine that allows browser extension users to opt-in to share unused internet bandwidth. This integration works with any WXT project structure and template.

## Prerequisites

- Existing WXT project (any template: vanilla, react, vue, svelte, etc.)
- Node.js and npm installed
- Mellowtel account and configuration key from https://mellowtel.com

## Integration Steps

### Quick File Summary
For automated integration, these are the files that need to be created/modified:

1. **Install package**: `npm install mellowtel`
2. **Modify**: `wxt.config.ts` - Add permissions
3. **Create**: `config/mellowtel.ts` - Configuration file
4. **Modify**: `entrypoints/background.ts` - Add mellowtel initialization
5. **Create**: `entrypoints/mellowtel.content.ts` - Dedicated content script
6. **Create/Modify**: `entrypoints/popup.html` + `entrypoints/popup/index.ts` - Add settings button

### 1. Package Installation

Always install mellowtel as a dependency:

```bash
npm install mellowtel
```

**Verification**: Check that `package.json` includes mellowtel in dependencies.

### 2. WXT Configuration Update

**File**: `wxt.config.ts` (or `wxt.config.js`)

**Action**: Add required permissions to the manifest configuration.

**For any existing config**, merge these permissions:

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  // ... existing configuration
  manifest: {
    // ... existing manifest configuration
    permissions: [
      // ... existing permissions
      'storage',
      'declarativeNetRequestWithHostAccess'
    ],
    host_permissions: [
      // ... existing host permissions
      '<all_urls>'
    ]
  }
});
```

**Edge Cases**:
- If `manifest` object doesn't exist, create it
- If `permissions` array doesn't exist, create it
- If `host_permissions` array doesn't exist, create it
- Always append to existing arrays, don't replace them

**Cross-browser compatibility**:
- Always use `declarativeNetRequestWithHostAccess` for compatibility across all browsers (Chrome, Firefox, Edge)

**Special Case - Existing `declarativeNetRequest` Permission**:
If your extension already has the `declarativeNetRequest` permission (without `WithHostAccess`) keep existing permission: No changes needed - `declarativeNetRequest` works with mellowtel

### 3. Configuration File Creation

**Create**: `config/mellowtel.ts` (or `config/mellowtel.js` for JS projects)

```typescript
// Mellowtel configuration
export const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY';

// IMPORTANT: Replace 'TEST_CONFIG_KEY' with the actual user's Mellowtel API key
// This placeholder will be replaced during the integration process
```

**Alternative locations** if `config/` doesn't exist:
- `src/config/mellowtel.ts`
- `js/config/mellowtel.ts`
- `lib/mellowtel.ts`
- `utils/mellowtel.ts`
- Root directory: `mellowtel.config.ts`

### 4. Background Script Integration

**Locate background script**:
- Common locations: `entrypoints/background.ts`, `src/background.ts`, `background/index.ts`
- WXT auto-detects based on file location in `entrypoints/`

**Integration pattern** (works with any existing background script):

**Important**: This integration avoids modifying existing event handlers. Before adding mellowtel's installation handler, you must check for existing `chrome.runtime.onInstalled` listeners in your background script AND any imported files - leave existing handlers unchanged.

```typescript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel'; // Adjust path as needed

// ... existing imports and code

export default defineBackground(() => {
  // ... existing background code

  // Mellowtel integration
  const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);

  (async () => {
    try {
      await mellowtel.initBackground();
      console.log('Mellowtel background initialized');
    } catch (error) {
      console.error('Mellowtel initialization failed:', error);
    }
  })();

  // Handle extension installation/update (check existing handlers first)
  // CRITICAL: Check for existing onInstalled handlers before adding this code:
  // 1. Search your background script for: chrome.runtime.onInstalled.addListener
  // 2. Check ALL imported files in your background script for the same patterns
  // 3. Search for: onInstalled.addListener, runtime.onInstalled, chrome.runtime.onInstalled
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

  // ... rest of existing background code
});
```

**For different background patterns**:

**Pattern 1 - Function-based**:
```typescript
export default defineBackground(() => {
  // Mellowtel integration
  const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
  
  (async () => {
    try {
      await mellowtel.initBackground();
    } catch (error) {
      console.error('Mellowtel initialization failed:', error);
    }
  })();

  // Handle extension installation/update (check existing handlers first)
  // CRITICAL: Check for existing onInstalled handlers before adding this code:
  // 1. Search your background script for: chrome.runtime.onInstalled.addListener
  // 2. Check ALL imported files in your background script for the same patterns
  // 3. Search for: onInstalled.addListener, runtime.onInstalled, chrome.runtime.onInstalled
  // 4. If existing handlers found, check if they create UI (tabs, windows, popups, notifications)
  // 5. If existing handlers create UI: DO NOT add this code (avoid conflicts)
  // 6. If existing handlers do NOT create UI: Safe to add this code alongside existing handlers
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (mellowtel) {
      try {
        await mellowtel.generateAndOpenOptInLink();
      } catch (error) {
        console.error('Failed to generate opt-in link:', error);
      }
    }
  });
});
```

**Pattern 2 - Object-based**:
```typescript
export default defineBackground({
  main() {
    // Mellowtel integration
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    
    (async () => {
      try {
        await mellowtel.initBackground();
      } catch (error) {
        console.error('Mellowtel initialization failed:', error);
      }
    })();

    // Handle extension installation/update (only add if no existing onInstalled handler)
    // Check your background script first - if you already have chrome.runtime.onInstalled.addListener,
    // do not add this code. Leave existing handlers unchanged.
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (mellowtel) {
        try {
          await mellowtel.generateAndOpenOptInLink();
        } catch (error) {
          console.error('Failed to generate opt-in link:', error);
        }
      }
    });
  }
});
```

**Pattern 3 - Persistent background (MV2)**:
```typescript
export default defineBackground({
  persistent: true,
  main() {
    // Mellowtel integration
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    
    (async () => {
      try {
        await mellowtel.initBackground();
      } catch (error) {
        console.error('Mellowtel initialization failed:', error);
      }
    })();

    // Handle extension installation/update (only add if no existing onInstalled handler)
    // Check your background script first - if you already have chrome.runtime.onInstalled.addListener,
    // do not add this code. Leave existing handlers unchanged.
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (mellowtel) {
        try {
          await mellowtel.generateAndOpenOptInLink();
        } catch (error) {
          console.error('Failed to generate opt-in link:', error);
        }
      }
    });
  }
});
```

### 5. Content Script Integration

**Always create a dedicated mellowtel content script** to avoid conflicts with existing content scripts.

**Create**: `entrypoints/mellowtel.content.ts` (or `.js` for JavaScript projects)

This follows WXT's naming convention where `{name}.content.ts` becomes `/content-scripts/{name}.js` in the build output.

```typescript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  main() {
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);

    (async () => {
      try {
        await mellowtel.initContentScript();
        console.log('Mellowtel content script initialized');
      } catch (error) {
        console.error('Mellowtel content script initialization failed:', error);
      }
    })();
  },
});
```

**Why create a separate content script?**
- **Non-invasive**: Doesn't modify existing content scripts
- **Isolation**: Mellowtel initialization is contained in its own file
- **Maintainability**: Easy to identify and update mellowtel-specific code
- **No conflicts**: Avoids potential issues with existing content script configurations

**File naming options** (all result in same output):
- `entrypoints/mellowtel.content.ts` → `/content-scripts/mellowtel.js`
- `entrypoints/mellowtel.content/index.ts` → `/content-scripts/mellowtel.js`

**For JavaScript projects**:
```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  main() {
    const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);

    (async () => {
      try {
        await mellowtel.initContentScript();
        console.log('Mellowtel content script initialized');
      } catch (error) {
        console.error('Mellowtel content script initialization failed:', error);
      }
    })();
  },
});
```

### 6. Popup Page Integration

Adding a settings button to your popup provides users easy access to Mellowtel settings. This section covers both creating a new popup and adding to an existing one.

#### Check if Popup Exists

Check your `entrypoints` folder for an existing popup:
- Look for `entrypoints/popup.html` or `entrypoints/popup/index.html`
- Look for `entrypoints/popup.ts` or `entrypoints/popup/index.ts`

- **If popup exists**: Follow **Option B: Add to Existing Popup**
- **If no popup**: Follow **Option A: Create New Popup**

#### Option A: Create New Popup (No Existing Popup)

If your extension doesn't have a popup, create one from scratch.

**Step 1: Create Popup HTML**

**Create**: `entrypoints/popup.html`

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
      margin-bottom: 24px;
      font-weight: 600;
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
  <script type="module" src="./popup/index.ts"></script>
</body>
</html>
```

**Step 2: Create Popup Script**

**Create**: `entrypoints/popup/index.ts` (or `popup/index.js` for JavaScript projects)

```typescript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel'; // Adjust path as needed

// Set extension name from manifest
const manifest = browser.runtime.getManifest();
const nameElement = document.getElementById('extension-name');
if (nameElement) {
  nameElement.textContent = manifest.name;
}

// Initialize Mellowtel and handle settings button
const settingsButton = document.getElementById('open-settings');
if (settingsButton) {
  settingsButton.addEventListener('click', async () => {
    try {
      const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
      const settingsUrl = await mellowtel.generateSettingsLink();
      
      // Open settings page in new tab
      browser.tabs.create({ url: settingsUrl });
    } catch (error) {
      console.error('Failed to open settings:', error);
      alert('Failed to open settings page. Please try again.');
    }
  });
}
```

**Note**: WXT automatically handles the popup configuration in the manifest, so no manual manifest updates are needed.

#### Option B: Add to Existing Popup

If you already have a popup, add the settings button following your existing design.

**Step 1: Add Settings Button to HTML**

Open your existing `entrypoints/popup.html` and add a settings button:

```html
<!-- Add this button to your existing popup.html -->
<button id="mellowtel-settings" class="your-existing-button-class">
  <span class="icon">⚙️</span>
  Open Settings Page
</button>
```

**Styling tips**:
- Use the same CSS classes as your existing buttons
- Match font sizes, colors, and spacing
- Use your extension's color scheme

**Step 2: Add JavaScript Handler**

Open your existing `entrypoints/popup/index.ts` (or popup script file) and add:

```typescript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel'; // Adjust path

// ... your existing popup code ...

// Add Mellowtel settings button handler
const mellowtelSettingsButton = document.getElementById('mellowtel-settings');
if (mellowtelSettingsButton) {
  mellowtelSettingsButton.addEventListener('click', async () => {
    try {
      const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
      const settingsUrl = await mellowtel.generateSettingsLink();
      
      // Open settings page in new tab
      browser.tabs.create({ url: settingsUrl });
    } catch (error) {
      console.error('Failed to open Mellowtel settings:', error);
    }
  });
}

// ... rest of your existing popup code ...
```

**For React/Vue/Svelte WXT Projects**:

If using a framework, integrate the button into your component:

```typescript
// React example
import { useState } from 'react';
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel';

function Popup() {
  const handleOpenSettings = async () => {
    try {
      const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
      const settingsUrl = await mellowtel.generateSettingsLink();
      browser.tabs.create({ url: settingsUrl });
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  return (
    <div>
      {/* Your existing popup content */}
      <button onClick={handleOpenSettings}>
        ⚙️ Open Settings Page
      </button>
    </div>
  );
}

export default Popup;
```

### 7. .gitignore Setup (Only if node_modules exists)

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

### 8. Path Alias Configuration

**Check path aliases** in the project's TypeScript configuration:

Common WXT path alias patterns:
- `@/` → project root
- `~/` → project root
- `src/` → src directory

**Adjust imports** based on project structure:
```typescript
// If config is in root
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel';

// If config is in src
import { MELLOWTEL_CONFIG_KEY } from '@/src/config/mellowtel';

// If no path aliases
import { MELLOWTEL_CONFIG_KEY } from '../config/mellowtel';
```

### 9. Framework-Specific Considerations

#### React/Vue/Svelte WXT Projects
- Integration remains the same
- Mellowtel doesn't interfere with UI frameworks
- Background and content scripts work independently of UI framework

#### TypeScript vs JavaScript
**TypeScript projects**: Use `.ts` extensions as shown above
**JavaScript projects**: Use `.js` extensions and remove type annotations

Example for JS:
```javascript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel.js';

export default defineBackground(() => {
  const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);

  (async () => {
    try {
      await mellowtel.initBackground();
    } catch (error) {
      console.error('Mellowtel failed:', error);
    }
  })();
});
```

## Validation Steps

### 1. Pre-build Validation
```bash
# Check TypeScript compilation
npm run compile

# Or for JS projects
npm run build -- --dry-run
```

### 2. Build Validation
```bash
# Build the extension
npm run build

# Check generated manifest
cat .output/chrome-mv3/manifest.json
```

**Expected manifest contents**:
```json
{
  "permissions": ["storage", "declarativeNetRequestWithHostAccess"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "all_frames": true,
      "run_at": "document_start",
      "js": ["content-scripts/mellowtel.js"]
    }
  ]
}
```

**Or if you already have declarativeNetRequest**:
```json
{
  "permissions": ["storage", "declarativeNetRequest"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "all_frames": true,
      "run_at": "document_start",
      "js": ["content-scripts/mellowtel.js"]
    }
  ]
}
```

## Error Handling and Troubleshooting

### Common Issues

#### 1. Import Path Errors
**Error**: `Cannot resolve module '@/config/mellowtel'`
**Solution**: Adjust import path based on project structure
```typescript
// Try different paths
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '../config/mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '../../config/mellowtel';
```

#### 2. Permission Conflicts
**Error**: Duplicate permissions in manifest
**Solution**: Merge permissions instead of replacing
```typescript
// Don't do this
permissions: ['storage', 'declarativeNetRequestWithHostAccess']

// Do this
permissions: [
  ...existingPermissions,
  'storage',
  'declarativeNetRequestWithHostAccess'
]
```

**Note**: If your extension already has `declarativeNetRequest` permission, you can keep it:
```typescript
permissions: [
  ...existingPermissions,
  'storage',
  'declarativeNetRequest'  // This works fine with mellowtel
]
```

#### 3. Content Script Match Conflicts
**Error**: Multiple content scripts with conflicting matches
**Solution**: Create separate mellowtel content script or modify existing to include `<all_urls>`

### Edge Cases

#### 1. Existing `<all_urls>` Permission
If project already has `<all_urls>`, no changes needed to host_permissions.

#### 2. Existing Storage Permission
If project already has `storage` permission, no changes needed.

#### 3. Existing Event Handlers

**Critical Check**: Before adding `chrome.runtime.onInstalled` handler, thoroughly check for existing handlers:

**Step 1: Check Main Background Script**
Search your `entrypoints/background.ts` (or similar) for these patterns:
```typescript
// Search for these exact patterns:
chrome.runtime.onInstalled.addListener
runtime.onInstalled.addListener
onInstalled.addListener
chrome.runtime.onInstalled =
```

**Step 2: Check All Imported Files**
WXT background scripts often import utilities. Check each imported file:
```typescript
// Example: if your background.ts has:
import { setupHandlers } from '@/utils/handlers';
import { initializeApp } from '@/lib/init';
import './setup/events';

// Then check: utils/handlers.ts, lib/init.ts, setup/events.ts
// Search each file for the same onInstalled patterns
```

**Step 3: Check WXT Auto-Generated Files**
WXT may auto-generate background code. Check:
- `.wxt/` directory (if exists)
- Any generated files in build output
- Framework-specific setup files

**Decision Rules**:
- **If NO existing handlers found**: You can safely add mellowtel's onInstalled handler
- **If existing handlers found**: Check if they create UI (new tabs, popups, etc.)
  - **If existing handlers create UI**: **DO NOT** add mellowtel's handler (avoid UI conflicts)
  - **If existing handlers do NOT create UI**: You can safely add mellowtel's handler alongside existing ones
- **Never modify** existing handlers - keep mellowtel code completely separate

**Step 4: Check if Existing Handlers Create UI**
If you found existing `onInstalled` handlers, examine their code for UI creation:
```typescript
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
  chrome.tabs.create({ url: '/welcome.html' }); // Creates UI - conflict risk
});

// Examples of non-UI handlers (SAFE to add mellowtel handler):
chrome.runtime.onInstalled.addListener(() => {
  console.log('WXT extension installed');      // No UI - safe
  chrome.storage.local.set({ version: '1.0' }); // No UI - safe
});
```

**Common WXT File Locations to Check**:
- `entrypoints/background.ts`
- `utils/`, `lib/`, `setup/`, `handlers/`, `js/` folders
- Any file imported in your background script
- Framework-specific initialization files

#### 4. MV2 Projects
For Manifest V2 projects:
```typescript
export default defineConfig({
  manifest: {
    manifest_version: 2,
    permissions: [
      'storage',
      'declarativeNetRequestWithHostAccess',
      '<all_urls>'
    ]
  }
});
```

**Or if you already have declarativeNetRequest**:
```typescript
export default defineConfig({
  manifest: {
    manifest_version: 2,
    permissions: [
      'storage',
      'declarativeNetRequest',
      '<all_urls>'
    ]
  }
});
```

**Note**: Both `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` work for both MV2 and MV3. If your extension already has `declarativeNetRequest`, you don't need to change it.

#### 5. Custom Entry Point Directories
If project uses custom entry point directories:
```typescript
export default defineConfig({
  entrypointsDir: 'src/entries', // Custom directory
  // ... rest of config
});
```

Adjust file locations accordingly.

## Important File Management Warning

**⚠️ CRITICAL: DO NOT add markdown (.md) files to your WXT extension folder after integration**

- **Never add**: README.md, CHANGELOG.md, documentation files, or any .md files to your WXT project's build output
- **Why**: Markdown files can interfere with extension packaging and store submission
- **WXT handles this**: WXT automatically excludes most non-essential files from builds, but be cautious

**Note**: WXT's `.output` directory should only contain extension files.

---

**Note**: This integration maintains all existing extension functionality while adding mellowtel monetization capabilities. The process is designed to be non-invasive and work with any WXT project structure.