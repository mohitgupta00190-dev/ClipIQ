# Mellowtel Integration Guide for Plasmo Extensions

This guide provides step-by-step instructions for integrating mellowtel monetization into any Plasmo browser extension project, regardless of the template, framework (React/Vue/Svelte), or existing structure (with/without src folder).

## Overview

Mellowtel is a consensual monetization engine that allows browser extension users to opt-in to share unused internet bandwidth. This integration works with any Plasmo project structure, template, and framework.

## Prerequisites

- Existing Plasmo project (any template: vanilla, React, Vue, Svelte, etc.)
- Node.js and npm/pnpm/yarn installed
- Mellowtel account and configuration key from https://mellowtel.com

## Integration Steps

### Quick File Summary
For automated integration, these are the files that need to be created/modified:

1. **Install package**: `pnpm install mellowtel` (or npm/yarn)
2. **Modify**: `package.json` - Add permissions to manifest
3. **Create**: `config/mellowtel.ts` or `.env` - Configuration
4. **Modify**: `background.ts` - Add mellowtel initialization
5. **Create**: `contents/mellowtel.ts` - Dedicated mellowtel content script
6. **Create/Modify**: `popup.tsx` - Add settings button

### 1. Package Installation

Install mellowtel as a dependency using package manager (follow project setup):

**Using pnpm (recommended by Plasmo):**
```bash
pnpm install mellowtel
```

**Using npm:**
```bash
npm install mellowtel
```

**Using yarn:**
```bash
yarn add mellowtel
```

**Verification**: Check that `package.json` includes mellowtel in dependencies.

### 2. Plasmo Manifest Configuration

**File**: `package.json`

**Action**: Add required permissions to the manifest section.

**For any existing package.json**, merge these permissions with existing ones:

```json
{
  "name": "your-extension-name",
  "version": "1.0.0",
  "description": "Your extension description",
  "manifest": {
    "permissions": [
      "storage",
      "declarativeNetRequestWithHostAccess"
    ],
    "host_permissions": [
      "<all_urls>"
    ]
  }
}
```

**Edge Cases**:
- If `manifest` object doesn't exist in package.json, create it
- If `permissions` array doesn't exist, create it
- If `host_permissions` array doesn't exist, create it
- Always merge with existing arrays, don't replace them

**Example with existing permissions**:
```json
{
  "manifest": {
    "permissions": [
      "activeTab",
      "tabs",
      "storage",
      "declarativeNetRequestWithHostAccess"
    ],
    "host_permissions": [
      "<all_urls>"
    ]
  }
}
```

**Cross-browser compatibility**:
- Always use `declarativeNetRequestWithHostAccess` for compatibility across all browsers (Chrome, Firefox, Edge)

**Special Case - Existing `declarativeNetRequest` Permission**:
If your extension already has the `declarativeNetRequest` permission (without `WithHostAccess`) keep existing permission: No changes needed - `declarativeNetRequest` works with mellowtel

### 3. Configuration Setup

Plasmo supports multiple configuration approaches. Choose the one that fits your project:

#### Option A: Environment Variables (Recommended)

**Create**: `.env` file in project root

```env
# Mellowtel configuration
PLASMO_PUBLIC_MELLOWTEL=TEST_CONFIG_KEY

# IMPORTANT: Replace 'TEST_CONFIG_KEY' with the actual user's Mellowtel API key
# This placeholder will be replaced during the integration process
```

**Usage in code**:
```typescript
const mellowtelKey = process.env.PLASMO_PUBLIC_MELLOWTEL;
```

#### Option B: Configuration File

**Create**: `config/mellowtel.ts` (or `config/mellowtel.js` for JS projects)

```typescript
// Mellowtel configuration
export const MELLOWTEL_CONFIG_KEY = 'TEST_CONFIG_KEY';

// IMPORTANT: Replace 'TEST_CONFIG_KEY' with the actual user's Mellowtel API key
// This placeholder will be replaced during the integration process
```

**Alternative locations** based on project structure:
- **With src folder**: `src/config/mellowtel.ts`
- **With js folder**: `js/config/mellowtel.ts`
- **Without src folder**: `config/mellowtel.ts`
- **Lib pattern**: `lib/mellowtel.ts`
- **Utils pattern**: `utils/mellowtel.ts`
- **Root directory**: `mellowtel.config.ts`

### 4. Background Script Integration

**Locate background script**:
- **Standard location**: `background.ts` or `background/index.ts`
- **With src folder**: `src/background.ts` or `src/background/index.ts`

**Integration pattern** (works with any existing background script):

**Important**: This integration avoids modifying existing event handlers. Before adding mellowtel's installation handler, you must check for existing `chrome.runtime.onInstalled` listeners in your background script AND any imported files - leave existing handlers unchanged.

#### Using Environment Variables:

```typescript
import Mellowtel from 'mellowtel';

// ... existing imports and code

let mellowtel: Mellowtel;

(async () => {
  try {
    mellowtel = new Mellowtel(process.env.PLASMO_PUBLIC_MELLOWTEL);
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

// ... existing background code
```

#### Using Configuration File:

```typescript
import Mellowtel from 'mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '~/config/mellowtel'; // Adjust path as needed

// ... existing imports and code

let mellowtel: Mellowtel;

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

// ... existing background code
```

### 5. Content Script Integration

**Always create a dedicated mellowtel content script** to avoid conflicts with existing content scripts.

**Recommended approach**: Always use the `contents` folder for better organization and proper Plasmo functionality.

**Create**: `contents/mellowtel.ts` (or `src/contents/mellowtel.ts` if using src folder)

**Important**: Plasmo requires the `contents` folder to exist for multiple content scripts to work properly. If you only have a single `content.ts` file, Plasmo will recognize it, but for multiple content scripts or better organization, always use the `contents` folder structure.

#### Using Environment Variables:

```typescript
import Mellowtel from 'mellowtel';
import type { PlasmoCSConfig } from 'plasmo';

// Configure content script to run on all URLs
export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  all_frames: true,
  run_at: 'document_start'
};

let mellowtel: Mellowtel;

const initMellowtel = async () => {
  try {
    mellowtel = new Mellowtel(process.env.PLASMO_PUBLIC_MELLOWTEL);
    await mellowtel.initContentScript();
    console.log('Mellowtel content script initialized');
  } catch (error) {
    console.error('Mellowtel content script initialization failed:', error);
  }
};

// Initialize mellowtel
initMellowtel();

```

#### Using Configuration File:

```typescript
import Mellowtel from 'mellowtel';
import type { PlasmoCSConfig } from 'plasmo';
import { MELLOWTEL_CONFIG_KEY } from '~/config/mellowtel'; // Adjust path as needed

// Configure content script to run on all URLs
export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  all_frames: true,
  run_at: 'document_start'
};

let mellowtel: Mellowtel;

const initMellowtel = async () => {
  try {
    mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY);
    await mellowtel.initContentScript();
    console.log('Mellowtel content script initialized');
  } catch (error) {
    console.error('Mellowtel content script initialization failed:', error);
  }
};

// Initialize mellowtel
initMellowtel();

```

**Why create a separate content script?**
- **Non-invasive**: Doesn't modify existing content scripts
- **Isolation**: Mellowtel initialization is contained in its own file
- **Maintainability**: Easy to identify and update mellowtel-specific code
- **No conflicts**: Avoids potential issues with existing content script configurations

**File naming for different project structures**:
- **Recommended**: `contents/mellowtel.ts` (create `contents` folder if it doesn't exist)
- **With src folder**: `src/contents/mellowtel.ts`

**Note**: Always create the `contents` folder even if you only have one content script. This ensures proper Plasmo functionality and allows for easy addition of more content scripts later.

### 6. Popup Page Integration

Adding a settings button to your popup provides users easy access to Mellowtel settings. This section covers both creating a new popup and adding to an existing one.

#### Check if Popup Exists

Check your project for an existing popup file:
- Look for `popup.tsx`, `popup.ts`, or `popup/index.tsx`
- Check `src/popup.tsx` or `src/popup/index.tsx` if using src folder

- **If popup exists**: Follow **Option B: Add to Existing Popup**
- **If no popup**: Follow **Option A: Create New Popup**

#### Option A: Create New Popup (No Existing Popup)

If your extension doesn't have a popup, create one from scratch.

**Step 1: Create Popup Component**

**Create**: `popup.tsx` (or `src/popup.tsx` if using src folder)

**For React (Default Plasmo template):**

```tsx
import { useState } from "react"
import Mellowtel from "mellowtel"
import { MELLOWTEL_CONFIG_KEY } from "~/config/mellowtel" // Or use process.env.PLASMO_PUBLIC_MELLOWTEL

import "./popup.css" // Optional: for custom styles

function IndexPopup() {
  const [loading, setLoading] = useState(false)

  const handleOpenSettings = async () => {
    setLoading(true)
    try {
      const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY)
      const settingsUrl = await mellowtel.generateSettingsLink()
      
      // Open settings page in new tab
      chrome.tabs.create({ url: settingsUrl })
    } catch (error) {
      console.error("Failed to open settings:", error)
      alert("Failed to open settings page. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        width: 300,
        padding: 20,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        textAlign: "center"
      }}>
      <h1 style={{ fontSize: 24, marginBottom: 24, fontWeight: 600 }}>
        Your Extension
      </h1>
      
      <button
        onClick={handleOpenSettings}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px 20px",
          background: "white",
          color: "#667eea",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}>
        <span style={{ marginRight: 8 }}>⚙️</span>
        {loading ? "Opening..." : "Open Settings Page"}
      </button>
    </div>
  )
}

export default IndexPopup
```

**Note**: Plasmo automatically handles the popup configuration in the manifest, so no manual manifest updates are needed.

#### Option B: Add to Existing Popup

If you already have a popup, add the settings button following your existing design.

**For React:**

```tsx
import Mellowtel from "mellowtel"
import { MELLOWTEL_CONFIG_KEY } from "~/config/mellowtel"

function IndexPopup() {
  const handleOpenSettings = async () => {
    try {
      const mellowtel = new Mellowtel(MELLOWTEL_CONFIG_KEY)
      const settingsUrl = await mellowtel.generateSettingsLink()
      chrome.tabs.create({ url: settingsUrl })
    } catch (error) {
      console.error("Failed to open settings:", error)
    }
  }

  return (
    <div>
      {/* Your existing popup content */}
      
      <button onClick={handleOpenSettings} className="your-button-class">
        ⚙️ Open Settings Page
      </button>
    </div>
  )
}

export default IndexPopup
```

**Styling tips**:
- Use your existing component/CSS class patterns
- Match the design language of your extension
- Consider using your existing UI component library if you have one

#### Using Environment Variables

If you're using the `.env` approach instead of a config file:

```tsx
// React example
const mellowtel = new Mellowtel(process.env.PLASMO_PUBLIC_MELLOWTEL)
```

Replace `MELLOWTEL_CONFIG_KEY` with `process.env.PLASMO_PUBLIC_MELLOWTEL` in all examples above.

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

### 8. Path Imports and Module Resolution

Plasmo supports several import path patterns. Adjust based on your project structure:

#### Common Path Patterns:

```typescript
// Tilde alias (root)
import { MELLOWTEL_CONFIG_KEY } from '~/config/mellowtel';

// At symbol alias (src folder)
import { MELLOWTEL_CONFIG_KEY } from '@/config/mellowtel';

// Relative paths
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '../config/mellowtel';

// Direct from src (if configured)
import { MELLOWTEL_CONFIG_KEY } from 'src/config/mellowtel';
```

#### TypeScript Configuration:

Check your `tsconfig.json` for path mapping:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["*"],
      "@/*": ["src/*"]
    }
  }
}
```

## Validation Steps

### Build Validation

```bash
# Build the extension
pnpm build

# Check generated manifest for Chrome
cat build/chrome-mv3-prod/manifest.json

# Check generated manifest for Firefox
cat build/firefox-mv3-prod/manifest.json
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
      "js": ["content.js"]
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
      "js": ["content.js"]
    }
  ]
}
```

## Error Handling and Troubleshooting

### Common Issues

#### 1. Import Resolution Errors
**Error**: `Cannot resolve module '~/config/mellowtel'`
**Solutions**:
```typescript
// Try different import patterns
import { MELLOWTEL_CONFIG_KEY } from './config/mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '../config/mellowtel';
import { MELLOWTEL_CONFIG_KEY } from '../../config/mellowtel';

// Or use environment variables instead
const key = process.env.PLASMO_PUBLIC_MELLOWTEL;
```

#### 2. Environment Variable Not Found
**Error**: `process.env.PLASMO_PUBLIC_MELLOWTEL is undefined`
**Solutions**:
1. Ensure `.env` file exists in project root
2. Verify variable name starts with `PLASMO_PUBLIC_`
3. Restart development server after adding .env file
4. Check file encoding (should be UTF-8)

#### 3. Manifest Permission Conflicts
**Error**: Invalid manifest or permission denied
**Solution**: Ensure permissions are properly merged:
```json
{
  "manifest": {
    "permissions": [
      "storage",
      "declarativeNetRequestWithHostAccess"
    ],
    "host_permissions": ["<all_urls>"]
  }
}
```

**Or if you already have declarativeNetRequest**:
```json
{
  "manifest": {
    "permissions": [
      "storage",
      "declarativeNetRequest"  // This works fine with mellowtel
    ],
    "host_permissions": ["<all_urls>"]
  }
}
```

#### 4. Content Script Configuration Issues
**Error**: Content script not running on all sites or not being recognized by Plasmo
**Solutions**: 
1. Verify PlasmoCSConfig:
```typescript
export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  all_frames: true,
  run_at: 'document_start'
};
```
2. Ensure content script is in `contents` folder (e.g., `contents/mellowtel.ts`)
3. Create `contents` folder if it doesn't exist - Plasmo requires this for multiple content scripts

#### 5. TypeScript Type Errors
**Error**: Type issues with Mellowtel or Plasmo
**Solutions**:
1. Install type definitions: `pnpm install -D @types/chrome`
2. Add to tsconfig.json:
```json
{
  "compilerOptions": {
    "types": ["chrome", "node"]
  }
}
```

### Edge Cases

#### 1. Existing Content Scripts
If you have existing content scripts, always create a separate mellowtel content script:
- Create `contents/mellowtel.ts` with `<all_urls>` matches
- Move existing content scripts to `contents` folder if they aren't already there
- Never modify existing content scripts - keep mellowtel isolated

#### 2. Existing Background Script Logic
Mellowtel integration should not interfere with existing background logic:
```typescript
// Existing background code
console.log('Extension background started');

// Add mellowtel (non-blocking)
(async () => {
  // Mellowtel initialization here
})();

// More existing background code
setupExistingFeatures();
```

#### 3. Existing Event Handlers

**Critical Check**: Before adding `chrome.runtime.onInstalled` handler, thoroughly check for existing handlers:

**Step 1: Check Main Background Script**
Search your `background.ts` (or `src/background.ts`) for these patterns:
```typescript
// Search for these exact patterns:
chrome.runtime.onInstalled.addListener
runtime.onInstalled.addListener
onInstalled.addListener
chrome.runtime.onInstalled =
```

**Step 2: Check All Imported Files**
Plasmo background scripts often import utilities. Check each imported file:
```typescript
// Example: if your background.ts has:
import { setupHandlers } from '~/utils/handlers';
import { initializeApp } from '~/lib/init';
import './setup/events';

// Then check: utils/handlers.ts, lib/init.ts, setup/events.ts
// Search each file for the same onInstalled patterns
```

**Step 3: Check Plasmo Auto-Generated Files**
Plasmo may auto-generate background code. Check:
- `.plasmo/` directory (if exists)
- Any generated files in build output
- Framework-specific setup files (React, Vue, Svelte)

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
chrome.windows.create()        // Create new window
chrome.action.openPopup()      // Opens popup
chrome.notifications.create()  // Shows notifications
window.open()                  // Opens new window/tab
chrome.runtime.openOptionsPage() // Opens extension options page

// Examples of UI-creating handlers (DO NOT add mellowtel handler):
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }); // Creates UI - conflict risk
});

// Examples of non-UI handlers (SAFE to add mellowtel handler):
chrome.runtime.onInstalled.addListener(() => {
  console.log('Plasmo extension installed');   // No UI - safe
  chrome.storage.sync.set({ initialized: true }); // No UI - safe
});
```

**Common Plasmo File Locations to Check**:
- `background.ts`, `src/background.ts`
- `utils/`, `lib/`, `setup/`, `handlers/`, `js/` folders
- Any file imported in your background script
- Framework-specific initialization files (React hooks, Vue composables, etc.)

#### 4. Custom Plasmo Configuration
If using `plasmo.config.ts`:
```typescript
import { defineConfig } from 'plasmo';

export default defineConfig({
  // Your custom config
  // Mellowtel works with any configuration
});
```

## Important File Management Warning

**⚠️ CRITICAL: DO NOT add markdown (.md) files to your Plasmo extension folder after integration**

- **Never add**: README.md, CHANGELOG.md, documentation files, or any .md files to your Plasmo project's build output
- **Why**: Markdown files can interfere with extension packaging and store submission
- **Plasmo handles this**: Plasmo automatically excludes most non-essential files from builds, but be cautious

**Note**: Plasmo's `build` directory should only contain extension files.

---

**Note**: This integration maintains all existing extension functionality while adding mellowtel monetization capabilities. The process is designed to be non-invasive and work with any Plasmo project structure, framework, or template.
