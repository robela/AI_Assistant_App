# AI Assistant App

## Running the Project

Open a **PowerShell** or **Command Prompt** terminal in VS Code (not WSL).

### Start the Expo dev server

```powershell
cd c:\Code\AI_Assistant_App\AI_Assistant_App
npx expo start --port 3000
```
if not working some networ use 
powershell.exe -Command "ipconfig | findstr /i 'IPv4\|Adapter'" use the ip example "172.20.10.3"
$env:REACT_NATIVE_PACKAGER_HOSTNAME="172.20.10.3"; npx expo start --clear --port 3000 
Scan the QR code in the terminal with the **Expo Go** app on your phone (same Wi-Fi required), or press:

- `a` — open on Android emulator
- `w` — open in web browser
- `r` — reload the app

> **Note:** Always use a PowerShell/CMD terminal, not WSL. WSL uses an internal IP that your phone cannot reach.
