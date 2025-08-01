#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { install } = require('../lib/installer');

program
  .name('create-df-mcp')
  .description('Install and configure DreamFactory MCP for Claude Desktop')
  .version('1.0.0')
  .action(async () => {

    try {
      await install();
    } catch (error) {
      console.error(chalk.red('\n❌ Installation failed:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
