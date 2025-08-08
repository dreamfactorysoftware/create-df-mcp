#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { install, uninstall } = require('../lib/installer');

program
  .name('create-df-mcp')
  .description('Install and configure DreamFactory MCP for Claude Desktop')
  .version('1.0.0')
  .option('--uninstall', 'uninstall DreamFactory and remove all components')
  .action(async (options) => {
    try {
      if (options.uninstall) {
        await uninstall();
      } else {
        await install();
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Operation failed:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
