# Fresh Issues

A lightweight React app that helps you discover fresh, beginner-friendly open source issues on GitHub. Filter by language, labels, time window, stars, and more — then jump straight into contributing.

## Features

- **Real-time issue discovery** — searches the GitHub Search API for open issues matching your criteria.
- **Smart filters** — filter by language, labels (`good first issue`, `help wanted`, etc.), time window, minimum stars, minimum comments, and sort order.
- **Repo tracking** — save specific repos and monitor them for new issues across all of them at once.
- **Auto-refresh & notifications** — optionally poll every 30 seconds and play a sound when new issues appear.
- **Dark / light theme** — toggle between themes; preference is persisted.
- **GitHub token support** — add a personal access token for higher rate limits (stored in `localStorage`).
- **Responsive** — collapsible sidebar with mobile support.

## Tech Stack

- **React 19** + **Vite 7**
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Radix UI** primitives with **shadcn/ui** components
- **Lucide React** icons
- **date-fns** for date formatting

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or yarn / pnpm)

### Install

```bash
git clone https://github.com/ragini-pandey/fresh-issues
cd issues
npm install
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
npm run preview   # preview the production build locally
```

## Usage

1. **Hunt issues** — type an `owner/repo` in the search bar (optional) and click **Hunt Issues**, or just hit search with the default filters to explore globally.
2. **Refine filters** — expand sidebar sections to narrow by time window, language, labels, min stars, sort order, or min comments.
3. **Track repos** — switch to the **Repos** tab, add repos you care about, and the app will aggregate issues from all of them.

![Add repos to track](https://github.com/ragini-pandey/fresh-issues/blob/main/public/my-repos.png)

4. **GitHub token** — click the settings gear in the sidebar to add a personal access token for higher API rate limits.

## Error Handling

The app includes comprehensive error handling for GitHub API requests:

### Common Errors

- **403 - Rate Limit Exceeded**: The GitHub API has strict rate limits:
  - **Without authentication**: 60 requests per hour
  - **With authentication**: 5,000 requests per hour
  - **Solution**: Add a GitHub Personal Access Token in Settings (⚙️ icon in sidebar)

- **401 - Authentication Failed**: Your GitHub token is invalid or expired
  - **Solution**: Update or remove your token in Settings

- **404 - Not Found**: Repository doesn't exist or you don't have access
  - **Solution**: Check the repository name format (`owner/repo`)

- **Network Errors**: Unable to connect to GitHub API
  - **Solution**: Check your internet connection

### Features

- **Detailed error messages**: Context-specific guidance for each error type
- **Retry functionality**: "Try Again" button on error screens
- **Partial failure handling**: When tracking multiple repos, the app will show warnings for failed repos while displaying successful results
- **Rate limit monitoring**: Visual indicators in the status bar when rate limits are running low
- **Auto-pause on rate limit**: Auto-refresh pauses when rate limits are exhausted

### GitHub Token Setup

To avoid rate limiting issues:

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token (classic) with `public_repo` scope (or no scopes for public data only)
3. Copy the token and paste it in the app's Settings
4. Your rate limit will increase from 60 to 5,000 requests/hour

### Issues List

![Issues list view](https://github.com/ragini-pandey/fresh-issues/blob/main/public/fresh-issue-list.png)

## Project Structure

```
src/
├── App.jsx                 # Root layout, theme toggle, view switching
├── components/
│   ├── IssueCard.jsx       # Single issue card
│   ├── IssueList.jsx       # Scrollable issue feed with load-more
│   ├── RepoManager.jsx     # Add / remove tracked repos
│   ├── Sidebar.jsx         # Filters, search, settings
│   ├── StatusBar.jsx       # Rate limit & refresh indicator
│   └── ui/                 # shadcn/ui primitives
├── hooks/
│   ├── useIssues.js        # Issue fetching, polling, state
│   ├── useRepos.js         # Repo list persistence (localStorage)
│   └── useTheme.jsx        # Dark/light theme context
├── services/
│   └── github.js           # GitHub API helpers & filter constants
└── lib/
    └── utils.js            # Tailwind class merge utility
```
