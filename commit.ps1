Set-Location 'C:\Code\AI_Assistant_App'

# Remove leftover generated dirs in the old subfolder
Remove-Item -Recurse -Force 'AI_Assistant_App' -ErrorAction SilentlyContinue

# Remove the stale root-level junk files (wrong package-lock + empty npx marker)
Remove-Item -Force 'npx' -ErrorAction SilentlyContinue

# Remove restructure script itself
Remove-Item -Force 'restructure.ps1' -ErrorAction SilentlyContinue

# Stage everything, commit, and push
git add -A
git status --short

Write-Host "`nReady to commit."
