# RagModel Frontend

Angular 20 frontend for the RagModel AI chat application. Connects to the RagModel-be FastAPI backend with JWT authentication and real-time streaming responses.

## Prerequisites

- **Node.js** 20.19+ or 22.12+ (required for Angular 20)
- **npm** (comes with Node.js)
- **Angular CLI** 20+

Check versions:
```bash
node --version
npm --version
ng version
```

## Installation

### 1. Install Angular CLI globally

```bash
npm install -g @angular/cli@20
```

### 2. Install project dependencies

```bash
cd ragmodel-fe
npm install
```

### 3. Verify PrimeNG installation

The project uses PrimeNG 20 for UI components. These should be installed automatically, but if needed:

```bash
npm install primeng @primeuix/themes @primeuix/styles primeicons
```

## Running the Application

### Development server

```bash
ng serve
```

Navigate to `http://localhost:4200`. The app reloads automatically on file changes.

### Run on different port

```bash
ng serve --port 4300
```

## Building

### Development build

```bash
ng build
```

### Production build

```bash
ng build --configuration=production
```

Output is stored in `dist/ragmodel-fe/`.

## Generating New Components

### Component

```bash
ng generate component components/my-component
# or shorthand
ng g c components/my-component
```

### Service

```bash
ng generate service services/my-service
# or shorthand
ng g s services/my-service
```

### Guard

```bash
ng generate guard guards/my-guard
# or shorthand
ng g g guards/my-guard
```

### Other schematics

```bash
ng g directive directives/my-directive
ng g pipe pipes/my-pipe
ng g interface models/my-interface
ng g class models/my-class
ng g enum models/my-enum
```

### Generate with options

```bash
# Skip test file
ng g c components/my-component --skip-tests

# Inline template and styles
ng g c components/my-component --inline-template --inline-style

# Flat (no subfolder)
ng g c components/my-component --flat
```

## Key Features

| Feature | Description |
|---------|-------------|
| JWT Authentication | Login/Register with token-based auth |
| Chat Management | Create, list, delete conversations |
| Real-time Streaming | SSE-based token streaming |
| Reactive State | Angular signals for state management |
| Greek Language | Full Greek UI support |
| PrimeNG UI | Modern component library |

## API Integration

The frontend connects to these backend endpoints:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Register user |
| `/auth/login` | POST | No | Login, get JWT |
| `/auth/me` | GET | Yes | Current user info |
| `/chats/` | GET | Yes | List chats |
| `/chats/` | POST | Yes | Create chat |
| `/chats/{id}` | DELETE | Yes | Delete chat |
| `/chats/{id}/messages` | GET | Yes | Get messages |
| `/chats/{id}/messages` | POST | Yes | Send message |
| `/stream/chat` | POST | Yes | Stream response (SSE) |

## Troubleshooting

### Module not found errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### Angular CLI version mismatch

```bash
npm install -g @angular/cli@20
npm install @angular/cli@20 --save-dev
```

### Port already in use

```bash
ng serve --port 4300
```

### CORS errors

Ensure backend has CORS enabled for `http://localhost:4200`:

```python
# In FastAPI backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Clear Angular cache

```bash
ng cache clean
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `ng serve` | Start dev server |
| `ng build` | Build project |
| `ng test` | Run unit tests |
| `ng lint` | Lint code |
| `ng update` | Update Angular |
| `ng version` | Show versions |
| `ng doc <keyword>` | Open Angular docs |

## Dependencies

### Core
- Angular 20.3
- RxJS 7.8
- TypeScript 5.9
- Zone.js 0.15

### UI
- PrimeNG 20.2
- PrimeIcons 7.0
- @primeuix/themes 1.2

## License

Private project - All rights reserved
