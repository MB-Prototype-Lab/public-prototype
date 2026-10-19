# MoneyBuddy prototype

This repository is the shared workspace for the MoneyBuddy prototype. An
operator can work with an agent from Claude Desktop on Windows or from a
terminal. The editable app is in `app/`; the repository root opens a selector
with a **Prototype** tab (the full app and a link to historical builds) and a
**Flows** tab (standalone Flows). Remote actions follow the [authorization boundary](CLAUDE.md#collaboration).

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
   > terminal or WSL. Verify Git for Windows and Docker Desktop with Linux containers.
   > Use Git's browser authentication or optional GitHub CLI browser sign-in.
   > Build the project check image and run its doctor on my behalf.
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

   For agents: use PowerShell and the [container launcher](docs/container-checks.md).
   Git and Docker are the project prerequisites; GitHub CLI is optional. Keep
   credentials out of chat and tool output. Preserve existing work, verify access,
   and select the cloned repository folder in the next Code session.

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

> Set up my MoneyBuddy checkout. Verify Git and Docker, build the project check
> image, and run its doctor. For this optional GitHub CLI authentication route, give me
> an OS-appropriate hidden prompt so I can paste my token directly into my own
> terminal for `gh auth login`; do not receive or print it yourself. Configure
> GitHub CLI as Git's HTTPS credential helper, then clone
> `https://github.com/MB-Prototype-Lab/public-prototype.git` if I do not have a
> checkout. Verify authentication, repository access, the remote, current
> branch, uncommitted files, and current `main`. Preserve existing work. Read
> `AGENTS.md`, `CLAUDE.md`, and `docs/workflow.md` before starting a task.

For agents: use the [container launcher](docs/container-checks.md) for checks.
Use a masked terminal prompt to pass the token on standard input to
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
and choose **Local Prototype** on the **Prototype** tab or a Flow on the **Flows** tab.
**Historical versions** opens the published builds in a new tab. No server or package installation
is needed. Refresh returns to the selector, from Local Prototype or a Flow. To stay
put while iterating, open **Tools** (the **›** beside the phone) and check **Pin on refresh**:
refresh then restarts the same app or Flow fresh, for that browser tab only, until you
uncheck it. **Exit Prototype** and **Exit Flow** return to the selector and leave the pin as
it is; **Restart Flow** always restarts in place. If you are using Claude Desktop,
ask the agent to show you the file in the Code tab's browser pane or open it
from the checkout folder in File Explorer.

For an exact address to paste into your browser, ask your agent:

> Show me the browser URL for this checkout.

The agent runs the container launcher's `helper local-variants url` command. It detects WSL and prints a
Windows browser URL using your actual distro name, or a native file URL when working
directly in Windows/macOS/Linux. Spaces and special characters are handled for you.
No `.env` file or manual distro-name lookup is needed. Creating variants also
prints the selector URL and each option's URL.

## 4. Ask your agent to use the project skills

The repository has eight skills in `.claude/skills/`. Name the relevant skill in
your request; the agent reads its instructions and the linked project guides.

| When you want to… | Ask for… | What the agent does |
| --- | --- | --- |
| Begin a task or resume unfinished work | [start-work](.claude/skills/start-work/SKILL.md) | Checks branches and uncommitted files, then starts or resumes a task branch without losing existing work. |
| Compare local variants | [compare-local](.claude/skills/compare-local/SKILL.md) | Creates independent previews of the app or one Flow, keeps a chosen variant, and cleans up only selected work. |
| Make or change a focused journey (a Flow) | [create-flow](.claude/skills/create-flow/SKILL.md) | Turns “only show…”, “skip onboarding…” or “start at…” into a contained Flow on the selector's Flows tab; the full app stays unchanged. |
| Bring in changes from `main` | [sync](.claude/skills/sync/SKILL.md) | Fetches and merges current `main` into your task branch, then checks affected work. |
| Set up or run automated checks | [run-checks](.claude/skills/run-checks/SKILL.md) | Builds the shared image and runs checks; host Git and Docker are sufficient. |
| Review finished changes before a PR | [pre-pr-review](.claude/skills/pre-pr-review/SKILL.md) | Delegates a cold review, resumes saved reviews, shows the exact preview and applies verified behavior-preserving fixes locally; eligible completed workspaces are cleaned automatically. |
| Get tested work into a pull request | [ship](.claude/skills/ship/SKILL.md) | Reviews changes, runs checks, prepares the PR, and records your testing. |
| Update the live selector or add a snapshot | [publish](.claude/skills/publish/SKILL.md) | Follows the release procedure after an explicit publication request. |

For example, say “Use `start-work` for this change” or “Use `ship` to prepare a
PR.” You check the affected app flow and record your result in the PR; the agent
handles routine code changes and automated checks. See
[Working together](docs/workflow.md), [Verification](docs/testing.md), and
[Publishing](docs/publishing.md) for the full procedures. To run every automated
check, ask your agent to “run all the checks”: it uses the [container launcher](docs/container-checks.md),
and each line says PASS, FAIL or BLOCKED. BLOCKED means this computer cannot run
that check; it is not a pass. Merging code does not update the live site.

For a cold review, use any of these requests:

- “Review my finished changes before a PR.”
- “Continue my pre-PR review.”
- “Show me the reviewed version.”
- “Clean up old review worktrees.”
- “Use ship to prepare the PR.”

The [review procedure](docs/pre-pr-review.md#requests-and-results) discovers saved
reviews for you and uses independent agents. It returns an outcome first, any
product decisions, the exact labeled version to test and your next action. Your
finished checkpoint and evidence remain available after eligible review workspaces
are cleaned automatically. Review is local; shipping remains a separate request.
Use your chosen native Windows or WSL/POSIX environment; you do not need both.
Workflow changes follow [platform acceptance](docs/pre-pr-review-platform-acceptance.md).

## Compare variants locally

Ask your agent: “Make two variants,” or “Make two variants of the Emergency fund
Flow.” It prepares named choices under **Prototype variants** on the selector's
**Prototype** tab, or under **Emergency fund variants** below the Flows list. The tab
shows how many there are, such as **Flows (2)**. Each row opens that variant in the
same tab; **Compare side by side** shows variants next to your current version.
Readable URL folders such as `variant-A` and `variant-B` help you identify the
option; later comparisons may add a suffix such as `variant-A-2`. Each variant runs
independently; refresh returns to the primary selector. In **Compare side by side**,
**Pin on refresh** beside **Visible panes** makes a refresh reopen the same panes from
the start. No server, package installation, or Git commands are needed from you.

Continue with “Change option A,” then “Keep B” when you choose. The agent verifies
and merges B into your task branch locally. Variants remain available to the
agent until you explicitly ask “Clean up this comparison.” The ordinary selector
returns when the comparison closes. See [local comparisons](docs/local-variants.md).

## Iterate on a contained Flow

Ask your agent: “Create a Flow for this proposal,” “Make a version that only shows
the emergency fund,” or “Change the Emergency Fund Flow.” The
[create-flow](.claude/skills/create-flow/SKILL.md) skill handles committed source
selection, package setup and checks; you review it from the selector's Flows tab or
its standalone file link. Such requests never become switches in the full app. `app/` stays the approved
product. Merging a Flow shares the proposal; adopting it means selectively integrating
the chosen behavior into the full app, then verifying that app before the PR opens.
See [Working with Flows](docs/flows.md).
