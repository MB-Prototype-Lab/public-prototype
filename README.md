# MoneyBuddy prototype

This repository is the shared workspace for the MoneyBuddy prototype. An
operator can work with an agent from Claude Desktop on Windows or from a
terminal. The editable app is in `app/`; the repository root opens a selector
for the local app and historical builds.

## 1. Confirm GitHub access

Sign in to GitHub with your own account and confirm you can open
[MB-Prototype-Lab/public-prototype](https://github.com/MB-Prototype-Lab/public-prototype).
If you cannot, ask the repository owner for access. Choose either setup path
below; you do not need WSL to use the Code tab in Claude Desktop on Windows.

## 2. Choose how to work

### Claude Desktop on Windows, without using a terminal

1. Install [Claude Desktop](https://claude.com/download), sign in, and open the
   **Code** tab. Choose **Local**, not WSL. [Claude's Desktop guide](https://code.claude.com/docs/en/desktop-quickstart)
   explains these controls; Code requires a paid Claude plan. If Code says Git
   is required, install [Git for Windows](https://git-scm.com/download/win)
   with its normal installer and restart Claude Desktop. If you already have a
   checkout, select its folder. Otherwise, make an empty work folder in File
   Explorer and select that folder.
2. Send the agent this request:

   > Set up MoneyBuddy for me in Claude Desktop on Windows. I do not use a
   > terminal or WSL. Install or verify Git for Windows and GitHub CLI, then
   > start GitHub CLI's browser sign-in and let me complete it in my browser.
   > Never ask me for a token in chat. Clone the repository from
   > `https://github.com/MB-Prototype-Lab/public-prototype.git` into this work
   > folder if it is not already here. Use the repository folder, not a Git
   > worktree. Verify access, the remote, current branch, uncommitted files,
   > and current `main`. Preserve existing work and tell me which repository
   > folder to select for my next Code session. Leave automatic merging off.
   > Read `AGENTS.md`, `CLAUDE.md`, and `docs/workflow.md` before starting a task.

   The agent can run setup commands; you only complete GitHub's browser sign-in
   and any Windows installer prompts. GitHub CLI may show a device code to enter
   in the browser. Review GitHub's authorization screen: this route uses a
   GitHub CLI account grant rather than the repository-scoped token below. If
   organization access is denied, ask the repository owner rather than changing
   repository settings yourself. [Claude Desktop's Code tab](https://code.claude.com/docs/en/desktop)
   works on Windows without selecting WSL, and [GitHub CLI supports browser sign-in](https://cli.github.com/manual/gh_auth_login).

   For agents: run `gh auth login --hostname github.com --git-protocol https --web`
   and let the operator finish the browser flow. Then run
   `gh auth setup-git --hostname github.com` and verify access with
   `gh repo view MB-Prototype-Lab/public-prototype`. Confirm GitHub CLI stores
   credentials securely; if it cannot, explain the issue before proceeding. Do
   not ask the operator to type commands, install WSL, create a personal token,
   or enable auto-merge for this path. Select the cloned repository folder in a
   new Code session before using the project skills.

### Terminal setup with a scoped token

If you use a terminal and want a token limited to this repository, create a
[fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
in your own GitHub account. Set **resource owner** to `MB-Prototype-Lab` and
**repository access** to **Only select repositories** → `public-prototype`.
Choose an expiration you can manage and set these **Repository permissions**:

| Permission | Access |
| --- | --- |
| Contents | Read and write |
| Pull requests | Read and write |
| Actions | Read-only |
| Checks | Read-only |

Leave other permissions at their default. If GitHub marks the token **pending**,
ask an organization owner to approve it. **Leave the token page open** while
your agent installs Git and [GitHub CLI](https://cli.github.com/). Then copy the
token from GitHub into a hidden prompt in your own terminal for `gh auth login`.
Close the page and clear your clipboard afterward. If you lose the token, revoke
it and create a new one. Treat it like an SSH private key: keep it out of agent
chat, Discord, password managers, documents, and repository files.

Send the agent this request:

> Set up my MoneyBuddy checkout. Install or verify Git and GitHub CLI. Give me
> an OS-appropriate hidden prompt so I can paste my token directly into my own
> terminal for `gh auth login`; do not receive or print it yourself. Configure
> GitHub CLI as Git's HTTPS credential helper, then clone
> `https://github.com/MB-Prototype-Lab/public-prototype.git` if I do not have a
> checkout. Verify authentication, repository access, the remote, current
> branch, uncommitted files, and current `main`. Preserve existing work. Read
> `AGENTS.md`, `CLAUDE.md`, and `docs/workflow.md` before starting a task.

For agents: use a masked terminal prompt to pass the token on standard input to
`gh auth login --hostname github.com --git-protocol https --with-token`. Keep it
out of chat, shell history, temporary files, and tool output. Confirm a secure
credential store is available; do not accept plaintext storage. Then run
`gh auth setup-git --hostname github.com` and verify access with
`gh repo view MB-Prototype-Lab/public-prototype`. Inspect an existing checkout
before changing branches or cloning again. If authentication fails, check the
account, repository selection, token expiration or approval, and permissions
without asking to see the token.

## 3. Preview the app

With a local checkout, open `index.html` in a browser, enter passcode `1337`,
and choose the local app. No server or package installation is needed for this
preview. A refresh returns to the selector. If you are using Claude Desktop,
ask the agent to show you the file in the Code tab's browser pane or open it
from the checkout folder in File Explorer.

## 4. Ask your agent to use the project skills

The repository has four skills in `.claude/skills/`. Name the relevant skill in
your request; the agent reads its instructions and the linked project guides.

| When you want to… | Ask for… | What the agent does |
| --- | --- | --- |
| Begin a task or resume unfinished work | [start-work](.claude/skills/start-work/SKILL.md) | Checks branches and uncommitted files, then starts or resumes a task branch without losing existing work. |
| Bring in changes from `main` | [sync](.claude/skills/sync/SKILL.md) | Fetches and merges current `main` into your task branch, then checks affected work. |
| Get tested work into a pull request | [ship](.claude/skills/ship/SKILL.md) | Reviews changes, runs checks, prepares the PR, and records your testing. A merge needs separate authorization. |
| Update the live selector or add a snapshot | [publish](.claude/skills/publish/SKILL.md) | Follows the release procedure after an explicit publication request. Publication needs separate authorization. |

For example, say “Use `start-work` for this change” or “Use `ship` to prepare a
PR.” You check the affected app flow and record your result in the PR; the agent
handles routine code changes and automated checks. See
[Working together](docs/workflow.md), [Verification](docs/testing.md), and
[Publishing](docs/publishing.md) for the full procedures. Merging code does not
update the live site. A GitHub login does not itself authorize a merge,
repository settings change, or publication.
