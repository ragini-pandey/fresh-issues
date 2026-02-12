# Issue Hunter

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
git clone https://github.com/abhishek-deshmukh-el/issues.git
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
4. **GitHub token** — click the settings gear in the sidebar to add a personal access token for higher API rate limits.

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

## License

MIT
