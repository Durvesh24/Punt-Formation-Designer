# Punt Formation Designer (PF) ⛵

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Konva](https://img.shields.io/badge/React--Konva-19.2-00D8FF)](https://konvajs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/State-Zustand-764ABC)](https://github.com/pmndrs/zustand)

A high-performance, real-time 2D canvas web application built for designing, animating, collision-checking, and synchronizing punt boat formations across devices.

---

## 🌟 Features

### 🎨 Interactive 2D Canvas Engine
* **Precision Drag & Rotation:** Smooth multi-object selection, drag-and-drop position controls, and precise angular rotations.
* **Dual-Color Region Targeting:** Customize punt colors independently for the **Front**, **Back**, or **Both** halves with preset color states (`Red`, `Yellow`, `Green`, `Off`).
* **Dynamic Punt Sizing:** Real-world proportional dimensions rendered for 16 distinct punt boats on canvas.

### 🛡️ Real-Time Collision Engine
* **Edge-to-Edge Detection:** Advanced geometric collision detection (`resolveCollisionsEdgeToEdge`) inspecting minimum separation distances between rectangular boat bounds.
* **Collision Alerts & Auto-Resolution:** Visual alerts when boats overlap with optional auto-push separation math to clear collisions instantly.

### 🎬 Multi-Scene Timeline & Animation
* **Keyframe Scenes:** Create, reorder, duplicate, and delete animation scenes in an interactive timeline.
* **Smooth Playback:** Play keyframed sequences with configurable scene durations and interpolated positions/rotations across scenes.

### ⚡ Cross-Device Real-Time Live Sync
* **Multi-Tab & Device Sync:** Powered by `itty-sockets` WebSockets channel sync (`punt-designer-global-sync`).
* **Live Presence Tracking:** Active online user counter and live updates across opened tabs or connected devices.
* **Mobile Viewer Mode:** Dedicated mobile-responsive viewer (`MobileThemeViewer`) to monitor active project scenes live on smartphones and tablets.

### 💾 Project & Theme Management
* **Multi-Project Workspaces:** Organize formations and shapes into distinct Themes/Projects.
* **Geometric Presets:** Built-in complex formation presets (e.g. *Octagon Star* formation).
* **Export & Sharing:** Base64 URL serialization and JSON export/import for sharing formation designs.
* **Local Storage Persistence:** Automatic local persistence for draft layouts and custom formation libraries.

---

## 🛠️ Tech Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) | Modern UI library with latest concurrent features |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict type safety across canvas nodes, state, and messaging |
| **Build Tool** | [Vite 8](https://vitejs.dev/) | Fast HMR dev server and optimized production bundler |
| **Canvas & Graphics** | [React-Konva](https://konvajs.org/) / [Konva](https://konvajs.org/) | 2D HTML5 canvas library for interactive node graphics |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) | Lightweight, decoupled global stores for editor, themes, and timeline |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility-first CSS styling and dark/light themes |
| **Networking** | [itty-sockets](https://github.com/kylebellamy/itty-sockets) | Lightweight WebSocket abstraction for real-time pub/sub synchronization |
| **Icons & Motion** | [Lucide React](https://lucide.dev/) & [Framer Motion](https://www.framer.com/motion/) | Sleek icon set and smooth UI micro-animations |

---

## 📁 Project Structure

```text
PF/
├── public/                 # Static public assets
├── src/
│   ├── components/         # React UI & Canvas Components
│   │   ├── HomePage.tsx            # Project hub & theme selector homepage
│   │   ├── StageArea.tsx           # Konva stage canvas container
│   │   ├── PuntNode.tsx            # Interactive individual punt boat renderer
│   │   ├── Sidebar.tsx             # Tools, color picker, preset manager, and theme controls
│   │   ├── Timeline.tsx            # Scene animation keyframe timeline bar
│   │   ├── Toolbar.tsx             # Top navigation bar (Undo, Redo, Theme toggle, Live status)
│   │   └── MobileThemeViewer.tsx   # Live sync mobile viewing mode
│   ├── store/              # Zustand Global Stores & Types
│   │   ├── types.ts                # Data models (PuntData, Formation, Scene, Theme)
│   │   ├── useEditorStore.ts       # Canvas tools, theme mode, selections, collision state
│   │   ├── useFormationStore.ts    # Punt nodes, history stack (undo/redo), saved formations
│   │   ├── useThemeStore.ts        # Project/Theme storage and workspace state
│   │   └── useTimelineStore.ts     # Animation keyframe scenes & playback control
│   ├── utils/              # Helper Utilities & Engines
│   │   ├── collision.ts            # Edge-to-edge collision detection & resolution algorithm
│   │   ├── presets.ts              # Mathematical preset generators (e.g., Octagon Star)
│   │   ├── sharing.ts              # Base64 shape serialization & deserialization
│   │   ├── sizes.ts                # Real-world boat dimensions per punt ID
│   │   └── stageRef.ts             # Canvas export reference wrapper
│   ├── App.tsx             # Root application & global WebSocket sync orchestrator
│   ├── App.css             # Component layout styles
│   ├── index.css           # Tailwind v4 import & theme utility definitions
│   └── main.tsx            # Application entry point
├── eslint.config.js        # ESLint rule configuration
├── package.json            # Project dependencies and npm scripts
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Durvesh24/Punt-Formation-Designer.git
   cd Punt-Formation-Designer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📜 Available Scripts

- `npm run dev` - Launches the Vite dev server with Hot Module Replacement (HMR).
- `npm run build` - Runs TypeScript type checking (`tsc -b`) and builds the production bundle into `dist/`.
- `npm run preview` - Locally previews the production build.
- `npm run lint` - Runs ESLint to verify code quality and style standards.

---

## 🔄 Real-Time Live Sync Architecture

```text
┌────────────────────────┐      itty-sockets       ┌────────────────────────┐
│   Browser Client A     │ ── (WebSocket Channel) ── │    Browser Client B    │
│  (Desktop / Workspace) │  "punt-designer-sync"   │  (Mobile Viewer / Tab) │
└────────────────────────┘                         └────────────────────────┘
            │                                                  │
            ├──── Broadcasts Heartbeat & User Count ──────────┤
            ├──── Syncs Theme / Formation Modifications ──────┤
            └──── Live Updates Canvas Node Positions ──────────┘
```

When multiple browser tabs or devices are open simultaneously:
1. Every client connects to the shared WebSocket channel `punt-designer-global-sync`.
2. Heartbeats (`GLOBAL_HEARTBEAT`) monitor active user presence across sessions.
3. Canvas adjustments, keyframe scene updates, and theme changes are broadcast instantly to keep all clients in sync.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).


