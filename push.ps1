Set-Location 'C:\Code\AI_Assistant_App'

# Remove this helper script from tracked files
git rm --cached gitpush.ps1 -f 2>$null
Remove-Item -Force 'gitpush.ps1' -ErrorAction SilentlyContinue

# Amend the last commit to exclude gitpush.ps1
git add -A
git commit --amend --no-edit

# Push main to origin (local branch is 'main')
Write-Host "=== Pushing to origin/main ==="
git push origin main
