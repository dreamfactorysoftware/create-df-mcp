# DreamFactory and MCP Server Installer

A CLI tool to install and configure the DreamFactory Server and DreamFactory MCP Server (Model Context Protocol) for Claude Desktop.

## Installation

This installer is only officially supported on macOS. It may work on Windows and probably works on Linux, but YMMV.

Run the installer using `npx`:

```bash
npx @dreamfactory/create-df-mcp
```

If you've never heard of the `npx` command, it is available on any machine that has npm (Node Package Manager) installed. `npx` is a convenient utility that can execute Node packages without having to install them.

Or if you'd like to contribute, you can follow these steps:

```bash
git clone git@github.com:dreamfactorysoftware/create-df-mcp.git
cd create-df-mcp
npx link
create-df-mcp
```

### Removing DreamFactory and the MCP Server

If you just wanted to give DreamFactory and the MCP server a quick spin, you can easily remove it from your environment:

```bash
npx @dreamfactory/create-df-mcp --uninstall
```

## What it does

The installer will do the following:

1. **Checks Docker installation** - Ensures Docker is installed and running. If Docker is not installed and you are on macOS it will guide you through the installation process.
2. **Sets up local DreamFactory** - Clones df-docker repository and runs DreamFactory locally
3. **Provides local access** - DreamFactory runs at http://127.0.0.1 with default credentials
4. **Example PostgreSQL DB configuration** - A fun PostgreSQL database is included with DreamFactory which you can optionally use for testing purposes. If you instead want to use your own datasource you can instead generate your own API in the local DreamFactory instance and give the API key to the installer.
5. **Optionall installs local DreamFactory MCP Server** - Clones and configures DreamFactory MCP server
6. **Optionally configures Claude Desktop** - Updates configuration to connect to your local databases

## Requirements

### For all installations:

- Node.js 14.0.0 or higher
- Git installed and available in PATH
- Claude Desktop application
- Internet connection for cloning repositories

### Additional for local installation:
- Available ports: 80 (web), 3306 (MySQL), 6379 (Redis)

## Configuration

### Local DreamFactory and DreamFactory MCP Server instances:
- Installs df-docker to `~/df-docker`
- Installs df-mcp to `~/df-mcp`
- Updates Claude Desktop config to connect to `http://127.0.0.1/api/v2/[your-service]`
- Requires initial setup: create admin account, add database service, configure RBAC, and generate API key

## License

MIT
