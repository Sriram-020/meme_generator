# How to Push "WatermelonStar PRO" to GitHub

Since `git` is not accessible from this specific command terminal, please follow these steps to push your project manually.

## Step 1: Create the Repository on GitHub
1. Go to **[https://github.com/new](https://github.com/new)**.
2. Make sure the owner is **Sriram-020**.
3. Set the Repository name to: `meme_generator`.
4. Click **Create repository**.

## Step 2: Initialize and Push (Run in your Terminal)
Open a terminal (Command Prompt, PowerShell, or Git Bash) in this folder:
`C:\Users\sairam.LAB11\Desktop\watermelonstar\watermelon-reactions`

Then run these commands one by one:

```powershell
# Initialize a new git repository
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial launch of WatermelonStar PRO"

# Rename the branch to main (standard practice)
git branch -M main

# Link your local repo to the new GitHub repo
git remote add origin https://github.com/Sriram-020/meme_generator.git

# Push the code
git push -u origin main
```

> **Note**: If `git push` fails asking for a password, you might need to use a [Personal Access Token](https://github.com/settings/tokens) if you are not using an SSH key.
