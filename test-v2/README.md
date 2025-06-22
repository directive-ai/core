# test-v2

Directive agents application test-v2

## Overview

This is a **Directive application** that orchestrates AI agents using state machines (XState).

**Author**: Test User  
**Version**: 1.0.0

## Project Structure

```
test-v2/
├── agents/                    # AI agents directory (currently empty)
│   └── .gitkeep              # Placeholder file
├── directive-conf.ts         # Application configuration (metadata only)
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Your First Agent
```bash
# Create an agent directly (no more sub-applications)
directive create agent my-agent
```

### 3. Start the Server
```bash
npm run dev
# or directly:
directive start
```

### 4. Test Your Agent
Once the server is running, you can interact with your agents via REST API:

```bash
# Create a session with your agent
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"agent_type": "test-v2/my-agent"}'

# List all available agents
curl http://localhost:3000/agents
```

## New Architecture (v2.0)

This application uses the new **simplified Directive architecture**:

- ✅ **Global configuration**: `~/.directive/config.json`
- ✅ **Global database**: `~/.directive/data/`  
- ✅ **Project = Application**: No more sub-applications
- ✅ **Direct agents**: `agents/my-agent/` instead of `agents/app/agent/`

## Available Commands

### Agent Management
```bash
directive create agent <name>           # Create a new agent directly  
directive deploy agent <name>           # Deploy agent (with versioning)
directive list agents                   # List all agents
```

### Server Management  
```bash
directive start                         # Start the Directive server
directive start --port 3001            # Start on custom port
```

### Development
```bash
npm run dev                             # Start server in development mode
npm run build                          # Build the project
npm test                               # Run tests
```

## Next Steps

1. **Create your first agent**: `directive create agent my-agent`
2. **Deploy your agent**: `directive deploy agent my-agent`
3. **Test via API**: Use the REST endpoints to create sessions
4. **Monitor deployments**: `directive deploy history`

---

Your Directive application is ready! 🚀

Create your first agent to get started:
```bash
directive create agent my-first-agent
```
