# DreamFactory and MCP Server Installer

A CLI tool to install and configure the DreamFactory Server and DreamFactory MCP Server (Model Context Protocol) for Claude Desktop.

## Installation

Run the installer using npx:

```bash
npx create-df-mcp
```

## What it does

The installer will do the following:

1. **Checks Docker installation** - Ensures Docker is installed and running
2. **Sets up local DreamFactory** - Clones df-docker repository and runs DreamFactory locally
3. **Provides local access** - DreamFactory runs at http://127.0.0.1 with default credentials
4. **Manual API key setup** - You create your own API key in the local DreamFactory instance
5. **Optionall installs local DreamFactory MCP Server** - Clones and configures DreamFactory MCP server
6. **Optionally configures Claude Desktop** - Updates configuration to connect to your local databases

## Requirements

### For all installations:

- Node.js 14.0.0 or higher
- Git installed and available in PATH
- Claude Desktop application
- Internet connection for cloning repositories

### Additional for local installation:
- Docker Desktop installed and running
- Available ports: 80 (web), 3306 (MySQL), 6379 (Redis)

## Manual Usage

If you've cloned this repository, you can also run:

```bash
npm install
npm link
create-df-mcp
```

## Configuration

### Local DreamFactory and DreamFactory MCP Server instances:
- Installs df-docker to `~/df-docker`
- Installs df-mcp to `~/df-mcp`
- Updates Claude Desktop config to connect to `http://127.0.0.1/api/v2/[your-service]`
- Requires initial setup: create admin account, add database service, configure RBAC, and generate API key

## License

MIT
