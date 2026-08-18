# Mellowtel Integration Guide for Windows Native (.NET) Apps

This guide tells you how to integrate the `Mellowtel.Win` NuGet package into any Windows desktop application built on .NET 10 (Console, WPF, or Windows Forms).

## Overview

Mellowtel is a consensual monetization SDK. Users explicitly opt in, and the SDK then shares a small fraction of their unused bandwidth in the background. The Windows SDK ships as the NuGet package `Mellowtel.Win` and runs on `net10.0` (or `net10.0-windows` for WPF/WinForms).

## Prerequisites

- Existing .NET project (Console / WPF / Windows Forms) in the target folder
- .NET 10 SDK (the package targets `net10.0` and will not restore against older TFMs)
- Mellowtel publishable key — the integration agent already substitutes `YOUR_INTEGRATION_ID` with the user's real key, so use that placeholder literally in any code you write

## Step 1: Locate the Target Project

The target folder may contain a solution (`.sln`), one `.csproj`, or several. Decide which project to integrate into:

1. If there is exactly one `.csproj`, use it.
2. If there is a `.sln`, parse it to find projects. Prefer the project marked `<OutputType>Exe</OutputType>` or `<OutputType>WinExe</OutputType>` (i.e., the executable, not class libraries).
3. If there are multiple executable projects, integrate into the one whose name matches the repository name, or the one without `Test`/`Tests` in its name. If still ambiguous, integrate into the first one and add a note to the PR.

Record the chosen project's directory — every subsequent step happens relative to it.

## Step 2: Detect the Application Sub-type

Read the chosen `.csproj` file. Determine the sub-type from these signals (in order — first match wins):

| Signal in `.csproj` | Sub-type |
|---|---|
| `<UseWPF>true</UseWPF>` | **WPF** |
| `<UseWindowsForms>true</UseWindowsForms>` | **Windows Forms** |
| `<OutputType>WinExe</OutputType>` without `UseWPF` / `UseWindowsForms` | **Windows Forms** (assume — most likely) |
| `<OutputType>Exe</OutputType>` (or no `OutputType`, which defaults to `Library` — skip non-exe projects) | **Console** |

Also read `<TargetFramework>` (or `<TargetFrameworks>` for multi-targeted projects):

- Acceptable: `net10.0`, `net10.0-windows`, or any TFM containing `net10.0` in a `<TargetFrameworks>` list.
- **Not acceptable** (abort with a clear message in the PR body): `net48`, `net472`, `netcoreapp3.1`, `net6.0`, `net7.0`, `net8.0`, `net9.0`, any `netstandard*`, any `netframework*`. The user must upgrade to .NET 10 before Mellowtel.Win can be added. **Do not silently upgrade the TFM** — that is a breaking change for the user's project.
- For WPF and Windows Forms, the TFM must end in `-windows` (e.g., `net10.0-windows`). If it's `net10.0` without `-windows` on a WPF/WinForms project, that is an existing project misconfiguration — flag it in the PR body but proceed.

## Step 3: Install the Mellowtel.Win Package

Add the package to the chosen `.csproj`. Prefer modifying the `.csproj` directly (works even when `dotnet` CLI isn't available on the agent runner):

Insert this `<ItemGroup>` if no equivalent `<PackageReference>` exists yet:

```xml
<ItemGroup>
  <PackageReference Include="Mellowtel.Win" Version="1.0.0" />
</ItemGroup>
```

If an `<ItemGroup>` containing other `<PackageReference>` entries already exists, append the new reference inside it rather than creating a duplicate group.

If the `dotnet` CLI is available in the working directory, you may also run `dotnet add package Mellowtel.Win` instead.

**Verification:** the `.csproj` contains a `<PackageReference Include="Mellowtel.Win" .../>` element.

## Step 4: Code Integration

Pick the section that matches the sub-type detected in Step 2. Do **not** apply more than one — they conflict.

### 4A — Console App

**File:** the project's `Program.cs` (top-level statements in modern .NET) or the file containing `static void Main` / `static async Task Main`.

Add the integration. Preserve any existing logic — wrap the existing entry-point work, do not replace it.

**For top-level-statements `Program.cs`** (common in .NET 6+ templates), prepend the SDK setup before existing code and append the cleanup at the end:

```csharp
using MellowtelWin;

// ... existing using statements ...

// ----- Mellowtel SDK setup -----
const string MELLOWTEL_KEY = "YOUR_INTEGRATION_ID";

using var mellowtel = new Mellowtel(MELLOWTEL_KEY, new MellowtelOptions
{
    PluginId = "your-app-id" // TODO: replace with a stable, unique identifier for this app
});

// Silently resume background sharing if the user previously opted in.
// No-op (returns false) when not opted in — does NOT throw.
await mellowtel.StartIfOptedInAsync();

// First-time consent: prompt the user via the console. Replace this block with
// a real consent flow (see Step 5 — User Consent).
if (!mellowtel.GetOptInStatus())
{
    Console.WriteLine();
    Console.WriteLine("This app uses Mellowtel to share a small portion of your unused");
    Console.WriteLine("internet bandwidth in exchange for supporting the developer.");
    Console.WriteLine("Terms:   https://www.mellowtel.com/terms-and-conditions");
    Console.WriteLine("Privacy: https://www.mellowtel.com/privacy-policy");
    Console.Write("Opt in? [y/N] ");
    var answer = Console.ReadLine();
    if (string.Equals(answer?.Trim(), "y", StringComparison.OrdinalIgnoreCase))
    {
        mellowtel.OptIn();
        await mellowtel.StartAsync();
    }
}
// ----- end Mellowtel SDK setup -----

// ... existing top-level statements stay here, unchanged ...

// ----- Mellowtel SDK shutdown (must run before the process exits) -----
await mellowtel.StopAsync();
// Dispose is handled by `using var` above when control leaves the file
```

**For traditional `Main` method**, place the SDK lifecycle inside `Main`:

```csharp
using MellowtelWin;

class Program
{
    static async Task Main(string[] args)
    {
        const string MELLOWTEL_KEY = "YOUR_INTEGRATION_ID";

        using var mellowtel = new Mellowtel(MELLOWTEL_KEY, new MellowtelOptions
        {
            PluginId = "your-app-id"
        });

        await mellowtel.StartIfOptedInAsync();

        // ... existing Main body ...

        await mellowtel.StopAsync();
    }
}
```

If existing `Main` is `static void Main`, change it to `static async Task Main` so `await` is legal. Add `using System.Threading.Tasks;` if missing.

### 4B — WPF App

**Files:**
- `App.xaml.cs` — for the SDK lifecycle (held for the lifetime of the application, not a single window)
- A new `MellowtelConsentDialog.xaml` + `.cs` — for the opt-in UI
- Whichever XAML the user uses for app settings (often `MainWindow.xaml`) — for the toggle entry point

#### Step 4B.1: Hold the SDK on the Application

Edit `App.xaml.cs`. If the file does not already inherit from `Application`, it does by default — just add the lifecycle code:

```csharp
using System.Windows;
using MellowtelWin;

namespace YourAppNamespace; // match the existing namespace

public partial class App : Application
{
    public static Mellowtel? MellowtelSdk { get; private set; }

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        MellowtelSdk = new Mellowtel("YOUR_INTEGRATION_ID", new MellowtelOptions
        {
            PluginId = "your-app-id"
        });

        // Resume silently if previously opted in. Does not throw if not opted in.
        await MellowtelSdk.StartIfOptedInAsync();
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        if (MellowtelSdk is not null)
        {
            await MellowtelSdk.StopAsync();
            MellowtelSdk.Dispose();
            MellowtelSdk = null;
        }
        base.OnExit(e);
    }
}
```

**If `App.xaml.cs` already defines `OnStartup` or `OnExit`**, do not duplicate the override — splice the new lines into the existing override body, preserving original behavior. Call `base.OnStartup(e)` / `base.OnExit(e)` only once.

#### Step 4B.2: Create the Consent Dialog

Create `MellowtelConsentDialog.xaml` in the project root (or wherever other dialogs/windows live):

```xml
<Window x:Class="YourAppNamespace.MellowtelConsentDialog"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Support the Developer"
        Width="460" Height="320"
        WindowStartupLocation="CenterOwner"
        ResizeMode="NoResize">
  <Grid Margin="20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <TextBlock Grid.Row="0" FontSize="18" FontWeight="SemiBold"
               Text="Help support this app"/>

    <TextBlock Grid.Row="1" Margin="0,12,0,12" TextWrapping="Wrap"
               Text="This app uses Mellowtel to share a small portion of your unused internet bandwidth. Trusted partners use it to retrieve publicly available data, and the developer earns a share. You can opt out at any time in settings."/>

    <StackPanel Grid.Row="2" Orientation="Horizontal">
      <TextBlock>
        <Hyperlink NavigateUri="https://www.mellowtel.com/terms-and-conditions"
                   RequestNavigate="OnNavigate">Terms of Service</Hyperlink>
      </TextBlock>
      <TextBlock Margin="12,0,0,0">
        <Hyperlink NavigateUri="https://www.mellowtel.com/privacy-policy"
                   RequestNavigate="OnNavigate">Privacy Policy</Hyperlink>
      </TextBlock>
    </StackPanel>

    <StackPanel Grid.Row="3" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,16,0,0">
      <Button Content="Decline" Width="100" Margin="0,0,8,0" Click="OnDecline"/>
      <Button Content="Accept"  Width="100" IsDefault="True" Click="OnAccept"/>
    </StackPanel>
  </Grid>
</Window>
```

And `MellowtelConsentDialog.xaml.cs`:

```csharp
using System.Diagnostics;
using System.Windows;
using System.Windows.Navigation;

namespace YourAppNamespace;

public partial class MellowtelConsentDialog : Window
{
    public MellowtelConsentDialog() => InitializeComponent();

    private void OnAccept(object sender, RoutedEventArgs e)  { DialogResult = true;  Close(); }
    private void OnDecline(object sender, RoutedEventArgs e) { DialogResult = false; Close(); }

    private void OnNavigate(object sender, RequestNavigateEventArgs e)
    {
        Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true });
        e.Handled = true;
    }
}
```

Match the actual namespace used by the existing project — read the namespace from `MainWindow.xaml.cs` or `App.xaml.cs`.

#### Step 4B.3: Settings Toggle Entry Point

In whichever window or page the user already uses for settings (commonly `MainWindow.xaml`), add a toggle. If no settings UI exists, add a single menu item or button on the main window:

```xml
<!-- somewhere inside the existing MainWindow content -->
<Button Content="Mellowtel: Support Developer" Click="OnToggleMellowtel"/>
```

And in `MainWindow.xaml.cs`:

```csharp
private async void OnToggleMellowtel(object sender, RoutedEventArgs e)
{
    var sdk = ((App)Application.Current).MellowtelSdk;
    if (sdk is null) return;

    if (sdk.GetOptInStatus())
    {
        sdk.OptOut();
        await sdk.StopAsync();
        MessageBox.Show("You have opted out of Mellowtel.", "Mellowtel",
                        MessageBoxButton.OK, MessageBoxImage.Information);
    }
    else
    {
        var dialog = new MellowtelConsentDialog { Owner = this };
        if (dialog.ShowDialog() == true)
        {
            sdk.OptIn();
            await sdk.StartAsync();
        }
    }
}
```

**Do not** add this code inside a constructor or `OnInitialized` — opt-in must happen only in response to explicit user action.

### 4C — Windows Forms App

**File:** the form that is the application entry point (usually `MainForm.cs` or whatever `Application.Run(new XxxForm())` references in `Program.cs`).

```csharp
using MellowtelWin;
using System.Diagnostics;

public partial class MainForm : Form
{
    private Mellowtel? _mellowtel;

    public MainForm()
    {
        InitializeComponent();
        Load += MainForm_Load;
        FormClosing += MainForm_FormClosing;
    }

    private async void MainForm_Load(object? sender, EventArgs e)
    {
        _mellowtel = new Mellowtel("YOUR_INTEGRATION_ID", new MellowtelOptions
        {
            PluginId = "your-app-id"
        });

        await _mellowtel.StartIfOptedInAsync();
    }

    // Wire this to a menu item / button labeled "Mellowtel: Support Developer"
    private async void ToggleMellowtel_Click(object? sender, EventArgs e)
    {
        if (_mellowtel is null) return;

        if (_mellowtel.GetOptInStatus())
        {
            _mellowtel.OptOut();
            await _mellowtel.StopAsync();
            MessageBox.Show(this, "You have opted out of Mellowtel.", "Mellowtel",
                            MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        var consent = MessageBox.Show(
            this,
            "This app uses Mellowtel to share a small portion of your unused internet bandwidth, " +
            "so trusted partners can retrieve publicly available data and the developer earns a share. " +
            "You can opt out at any time in settings.\r\n\r\n" +
            "Open Terms and Privacy in your browser before deciding?",
            "Support the Developer",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Question);

        if (consent == DialogResult.Yes)
        {
            Process.Start(new ProcessStartInfo("https://www.mellowtel.com/terms-and-conditions") { UseShellExecute = true });
            Process.Start(new ProcessStartInfo("https://www.mellowtel.com/privacy-policy")       { UseShellExecute = true });
            return; // user can click the menu item again after reading
        }
        if (consent != DialogResult.No) return; // Cancel

        _mellowtel.OptIn();
        await _mellowtel.StartAsync();
    }

    private async void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        if (_mellowtel is not null)
        {
            await _mellowtel.StopAsync();
            _mellowtel.Dispose();
        }
    }
}
```

A `MessageBox`-based consent is acceptable for WinForms only if the user's existing UI is similarly minimal. If the project already has a richer dialog framework, create a dedicated form modeled on the WPF dialog above.

**Add an entry point** for `ToggleMellowtel_Click` if no menu/button exists yet. The most non-invasive option is a single `ToolStripMenuItem` under an existing **Help** or **Settings** menu, or a single `Button` on the form if there's no menu strip.

## Step 5: User Consent Requirements

Consent is mandatory. The SDK throws `InvalidOperationException` from `StartAsync()` if `OptIn()` has not been called. Whatever consent UI you create (the WPF dialog, the WinForms `MessageBox`, or the Console prompt) **must**:

1. Explain in plain language that Mellowtel shares a small portion of unused bandwidth.
2. Present **distinct** Accept and Decline controls. Decline must be a real option, not just a window-close.
3. Link to (or show) the Terms (`https://www.mellowtel.com/terms-and-conditions`) and Privacy Policy (`https://www.mellowtel.com/privacy-policy`).
4. Be reachable again later from settings, so the user can opt out.

`StartIfOptedInAsync()` is the safe boot-time call — it never throws when the user hasn't opted in. Use it on app launch. Use `StartAsync()` only **after** `OptIn()` has just been called as a result of user action.

## Step 6: Shutdown Semantics

The SDK holds a background WebSocket. Failing to stop it leaves a connection hanging on process exit and prevents graceful cleanup.

- **Console / top-level Program.cs:** call `await mellowtel.StopAsync()` before the process exits. `using var` handles `Dispose`.
- **WPF:** call `await MellowtelSdk.StopAsync()` and `MellowtelSdk.Dispose()` inside `App.OnExit`.
- **WinForms:** call them inside `FormClosing` on the main form.

The WPF doc notes a subtle issue with `async void OnClosing` (the window closes before the await finishes). For most apps this is fine because the process exits immediately. Don't introduce the more complex deferral pattern unless the host app already uses it.

## Step 7: Threading Note

`ConnectionStateChanged` and `MessageReceived` events fire on a **background thread**. UI-bound handlers must marshal:

- WPF: `Dispatcher.Invoke(() => /* update UI */);`
- WinForms: `if (InvokeRequired) Invoke(() => /* update UI */); else /* update UI */;`
- Console: no marshalling needed.

Only wire these events if the integration actually displays connection state. Default integration does not need them.

## Step 8: Validation

Run from the chosen project's directory (or solution root):

```bash
dotnet restore
dotnet build
```

**Expected outcomes:**
- `dotnet restore` resolves `Mellowtel.Win` from nuget.org. No errors.
- `dotnet build` succeeds with no errors. Warnings are acceptable.

**If restore fails with `NU1202` ("Package Mellowtel.Win is not compatible")**: the project is not targeting `net10.0`. Stop the integration; revert the `.csproj` change; document the TFM mismatch in the PR body so the human reviewer knows the user must upgrade.

**If build fails with a namespace / using error**: confirm `using MellowtelWin;` was added to every file that references the `Mellowtel` type, and the namespace declarations in any new `MellowtelConsentDialog` files match the rest of the project.

Do not run `dotnet run` — the agent has no display and no opted-in user; the result is meaningless and the WebSocket connection attempt will hang.

## Edge Cases

**Multi-target project (`<TargetFrameworks>net10.0;net8.0</TargetFrameworks>`):**
The package only restores against `net10.0`. Leave the project's `TargetFrameworks` alone. Mellowtel calls will compile only against the `net10.0` target. Add a comment in the PR body so the reviewer knows.

**Solution with multiple executable projects:**
Apply the integration to one project only (see Step 1). Note in the PR body which one and why.

**F# project (`.fsproj`):**
Out of scope for this guide. Stop integration and explain in the PR body that the user must contact Mellowtel for F# support.

**.NET Framework project (`<TargetFramework>net48</TargetFramework>` or similar):**
Not supported by `Mellowtel.Win`. Stop integration. Do not change the TFM. Explain in the PR body that the user must migrate to .NET 10.

**Existing global `Application` subclass with custom logic:**
Splice the SDK lifecycle calls into the existing `OnStartup` / `OnExit` overrides rather than redefining them. Preserve all existing behavior.

**`PluginId` collisions:**
`PluginId` should be a stable, unique-per-app identifier. If the project's `.csproj` has an `<AssemblyName>` or `<RootNamespace>`, use that (kebab-cased) as the `PluginId`. Otherwise, use the repository name from the working directory.

**Repository contains a ZIP file at the root:**
The user uploaded the project as a ZIP that was already extracted by the agent. If you still see an unextracted `.zip` at the repository root, extract it into a subdirectory called `uploaded-content/` first, then run the entire integration against that subdirectory.

## File Management

- **Do not** add `.md` files inside the user's project. The PR description is where you communicate review notes.
- **Do not** modify the user's existing `.gitignore` unless adding entries that the integration itself needs (none, for .NET projects on this guide).
- **Do not** check in `bin/`, `obj/`, `*.user`, or `node_modules/` if any of those somehow appeared after the integration.

## Important Notes

- The integration is non-invasive: it adds code, never removes existing functionality.
- The SDK runs in the background and only activates when the user has opted in **and** there is sufficient idle bandwidth.
- All consent is opt-out by default — the user must take explicit action to enable Mellowtel.
