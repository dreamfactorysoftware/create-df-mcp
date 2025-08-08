const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const axios = require('axios');
const ora = require('ora');
const chalk = require('chalk');
const inquirer = require('inquirer');

const execAsync = promisify(exec);

class DFMCPInstaller {
  constructor() {
    this.homeDir = os.homedir();
    this.installDir = path.join(this.homeDir, 'df-mcp');
    this.dockerDir = path.join(this.homeDir, 'df-docker');
    this.claudeConfigPath = path.join(this.homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    this.dreamfactoryUrl = null;
  }

  async uninstall() {
    try {
      console.log(chalk.blue('\n🗑️  DreamFactory Uninstaller\n'));
      console.log(chalk.white('This uninstaller will:'));
      console.log(chalk.white('  1. Stop and remove all DreamFactory Docker containers'));
      console.log(chalk.white('  2. Remove all DreamFactory Docker images and volumes'));
      console.log(chalk.white('  3. Remove the DreamFactory MCP server from Claude Desktop configuration'));
      console.log(chalk.white('  4. Remove local DreamFactory installation directories\n'));

      console.log(chalk.yellow('⚠️  Important: This will remove DreamFactory and the APIs but will NOT delete'));
      console.log(chalk.yellow('    any connected data sources (databases, files, etc.).\n'));

      const { confirmDelete } = await inquirer.prompt([{
        type: 'input',
        name: 'confirmDelete',
        message: 'Type "delete" to confirm uninstallation:',
        validate: input => input === 'delete' || 'You must type "delete" to continue'
      }]);

      console.log(chalk.yellow('\n🧹 Starting uninstallation...\n'));

      // Remove Docker containers, images, and volumes
      await this.cleanupDocker();

      // Remove Claude Desktop configuration
      await this.cleanupClaudeConfig();

      // Remove installation directories
      await this.cleanupDirectories();

      console.log(chalk.green('\n✅ DreamFactory uninstallation complete!'));
      console.log(chalk.blue('All DreamFactory components have been removed from your system.'));

    } catch (error) {
      console.error(chalk.red('\n❌ Uninstallation failed:'), error.message);
      process.exit(1);
    }
  }

  async cleanupDocker() {
    const spinner = ora('Cleaning up Docker containers, images, and volumes...').start();

    try {
      // Stop and remove containers
      try {
        spinner.text = 'Stopping DreamFactory containers...';
        await execAsync('docker compose down', { cwd: this.dockerDir });
      } catch (error) {
        // Continue if compose down fails
      }

      // Remove containers by name pattern
      try {
        spinner.text = 'Removing DreamFactory containers...';
        await execAsync('docker ps -aq --filter "name=df-" | xargs -r docker rm -f');
      } catch (error) {
        // Continue if no containers found
      }

      // Remove images
      try {
        spinner.text = 'Removing DreamFactory Docker images...';
        const { stdout } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "df-docker|dreamfactory|redis|mysql|aa8y/postgres-dataset"');
        if (stdout.trim()) {
          const images = stdout.trim().split('\n');
          for (const image of images) {
            await execAsync(`docker rmi -f "${image}"`);
          }
        }
      } catch (error) {
        // Continue if no images found
      }

      // Remove volumes
      try {
        spinner.text = 'Removing DreamFactory Docker volumes...';
        const { stdout } = await execAsync('docker volume ls --format "{{.Name}}" | grep -E "df-docker|dreamfactory"');
        if (stdout.trim()) {
          const volumes = stdout.trim().split('\n');
          for (const volume of volumes) {
            await execAsync(`docker volume rm -f "${volume}"`);
          }
        }
      } catch (error) {
        // Continue if no volumes found
      }

      spinner.succeed('Docker cleanup complete');
    } catch (error) {
      spinner.fail('Docker cleanup failed');
      throw new Error(`Docker cleanup failed: ${error.message}`);
    }
  }

  async cleanupClaudeConfig() {
    const spinner = ora('Removing DreamFactory from Claude Desktop configuration...').start();

    try {
      if (await fs.pathExists(this.claudeConfigPath)) {
        const config = await fs.readJson(this.claudeConfigPath);

        if (config.mcpServers && config.mcpServers['df-mcp']) {
          delete config.mcpServers['df-mcp'];
          await fs.writeJson(this.claudeConfigPath, config, { spaces: 2 });
          spinner.succeed('Removed DreamFactory from Claude Desktop configuration');
        } else {
          spinner.succeed('DreamFactory not found in Claude Desktop configuration');
        }
      } else {
        spinner.succeed('Claude Desktop configuration not found');
      }
    } catch (error) {
      spinner.fail('Failed to clean Claude Desktop configuration');
      throw new Error(`Claude config cleanup failed: ${error.message}`);
    }
  }

  async cleanupDirectories() {
    const spinner = ora('Removing installation directories...').start();

    try {
      if (await fs.pathExists(this.dockerDir)) {
        spinner.text = 'Removing df-docker directory...';
        await fs.remove(this.dockerDir);
      }

      if (await fs.pathExists(this.installDir)) {
        spinner.text = 'Removing df-mcp directory...';
        await fs.remove(this.installDir);
      }

      spinner.succeed('Installation directories removed');
    } catch (error) {
      spinner.fail('Failed to remove installation directories');
      throw new Error(`Directory cleanup failed: ${error.message}`);
    }
  }

  async install() {
    try {
      // Explain what the installer will do
      console.log(chalk.blue('\n🚀 Welcome to the DreamFactory Installer\n'));
      console.log(chalk.white('This installer will:'));
      console.log(chalk.white('  1. Install DreamFactory locally using Docker'));
      console.log(chalk.white('  2. Optionally install the DreamFactory MCP server for Claude Desktop\n'));

      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Would you like to proceed with the installation?',
        default: true
      }]);

      if (!proceed) {
        console.log(chalk.blue('ℹ Installation cancelled by user.'));
        return;
      }

      // Step 1: Install DreamFactory
      console.log(chalk.yellow('\n📦 Step 1: Installing DreamFactory\n'));

      // Check Docker and set up local DreamFactory
      await this.checkDocker();
      await this.setupLocalDreamFactory();

      // Show user the local DreamFactory URL
      console.log(chalk.green('\n✅ DreamFactory is running locally!'));
      console.log(chalk.blue('\n🌐 You can access DreamFactory at: ') + chalk.cyan.underline('http://127.0.0.1'));

      // Step 2: Set up DreamFactory admin account and optionally generate demo API
      console.log(chalk.yellow('\n📋 Step 2: DreamFactory Setup\n'));

      // First, ensure user has created an admin account
      console.log(chalk.white('Please ensure you have:'));
      console.log(chalk.white('   1. Navigated to ') + chalk.cyan.underline('http://127.0.0.1'));
      console.log(chalk.white('   2. Created a System Administrator account\n'));

      const { hasAdminAccount } = await inquirer.prompt([{
        type: 'confirm',
        name: 'hasAdminAccount',
        message: 'Have you created a System Administrator account?',
        default: false
      }]);

      if (!hasAdminAccount) {
        console.log(chalk.yellow('\n⚠️  Please create an admin account first, then run this installer again.'));
        return;
      }

      // Ask if they want to generate a demo PostgreSQL API
      const { generateDemo } = await inquirer.prompt([{
        type: 'confirm',
        name: 'generateDemo',
        message: 'Would you like to generate a demo PostgreSQL API for testing?',
        default: true
      }]);

      let apiKey, serviceName;
      let demoGenerated = false;

      if (generateDemo) {
        // Get admin credentials
        console.log(chalk.yellow('\n🔑 Please provide your DreamFactory admin credentials:'));

        const { adminEmail } = await inquirer.prompt([{
          type: 'input',
          name: 'adminEmail',
          message: 'Admin email address:',
          validate: input => input.includes('@') || 'Please enter a valid email address'
        }]);

        const { adminPassword } = await inquirer.prompt([{
          type: 'password',
          name: 'adminPassword',
          message: 'Admin password:',
          mask: '*',
          validate: input => input.length > 0 || 'Password is required'
        }]);

        // Generate the demo API
        const result = await this.generateDemoAPI(adminEmail, adminPassword);
        if (result) {
          apiKey = result.apiKey;
          serviceName = 'pgsql';
          demoGenerated = true;
          console.log(chalk.green('\n✅ Demo PostgreSQL API generated successfully!'));
          console.log(chalk.cyan('API Key: ') + chalk.white(apiKey));
        } else {
          console.log(chalk.yellow('\n⚠️  Failed to generate demo API.'));
        }
      }

      // Step 3: Optionally install MCP server
      console.log(chalk.yellow('\n📦 Step 3: DreamFactory MCP Server (Optional)\n'));

      const { installMCP } = await inquirer.prompt([{
        type: 'confirm',
        name: 'installMCP',
        message: 'Would you like to install the DreamFactory MCP server for Claude Desktop?',
        default: true
      }]);

      if (!installMCP) {
        console.log(chalk.green('\n✅ DreamFactory installation complete!'));
        console.log(chalk.blue('You can access DreamFactory at: ') + chalk.cyan.underline('http://127.0.0.1'));
        if (apiKey) {
          console.log(chalk.cyan('Your API Key: ') + chalk.white(apiKey));
        }
        return;
      }

      // If user wants MCP but doesn't have an API key yet, prompt for manual setup
      if (!apiKey) {
        console.log(chalk.yellow('\n📋 To use the MCP server, you need a DreamFactory API key.'));
        console.log(chalk.white('Please manually set up your API in DreamFactory:'));
        console.log(chalk.white('   1. Add a database service'));
        console.log(chalk.white('   2. Create a Role with appropriate permissions (RBAC)'));
        console.log(chalk.white('   3. Create an App and generate an API key'));
        console.log(chalk.white('   4. Copy the API key to paste below'));

        const { ready } = await inquirer.prompt([{
          type: 'confirm',
          name: 'ready',
          message: 'Have you completed the setup and created an API key?',
          default: false
        }]);

        if (!ready) {
          console.log(chalk.yellow('\n⚠️  MCP server installation cancelled.'));
          console.log(chalk.green('\n✅ DreamFactory installation complete!'));
          console.log(chalk.blue('You can access DreamFactory at: ') + chalk.cyan.underline('http://127.0.0.1'));
          return;
        }

        // Ask for API key
        const apiKeyResponse = await inquirer.prompt([{
          type: 'input',
          name: 'apiKey',
          message: 'Enter your DreamFactory API key:',
          validate: input => input.length > 0 || 'API key is required'
        }]);
        apiKey = apiKeyResponse.apiKey;

        // Ask for service name
        const serviceResponse = await inquirer.prompt([{
          type: 'input',
          name: 'serviceName',
          message: 'Enter your DreamFactory service name:',
          default: 'db',
          validate: input => input.length > 0 || 'Service name is required'
        }]);
        serviceName = serviceResponse.serviceName;
      }

      // Proceed with MCP installation
      this.dreamfactoryUrl = `http://127.0.0.1/api/v2/${serviceName}`;

      // Clone and build MCP repository
      await this.cloneAndBuildRepository();

      // Ask for MCP client choice
      const client = await this.askForClient();

      // Update Claude config
      await this.updateClaudeConfig(apiKey);

      // Success message
      console.log(chalk.green('\n✅ Installation complete!'));
      console.log(chalk.yellow('\n⚠️  Please restart Claude Desktop to start using DreamFactory MCP.'));

    } catch (error) {
      throw error;
    }
  }

  async checkDocker() {
    const spinner = ora('Checking Docker installation...').start();

    try {
      // Check if Docker is installed
      await execAsync('docker --version');

      // Check if Docker daemon is running
      await execAsync('docker info');

      spinner.succeed('Docker is installed and running');
    } catch (error) {
      spinner.fail('Docker is not installed or not running');

      // Check if we're on macOS and Brew is available
      const platform = os.platform();
      if (platform === 'darwin') {
        try {
          await execAsync('brew --version');

          console.log(chalk.red('\n❌ Docker is required for local DreamFactory installation.'));
          console.log(chalk.yellow('\n📦 Homebrew is installed on your system.'));

          const { installDocker } = await inquirer.prompt([{
            type: 'confirm',
            name: 'installDocker',
            message: 'Would you like to install Docker using Homebrew?',
            default: true
          }]);

          if (installDocker) {
            console.log(chalk.yellow('\n📋 Docker will be installed via Homebrew.'));
            console.log(chalk.white('Note: You may be prompted for your admin password during installation.\n'));

            // Detect architecture
            const { stdout: archOutput } = await execAsync('uname -m');
            const isAppleSilicon = archOutput.trim() === 'arm64';

            // Provide the command for the user to run
            const dockerCommand = isAppleSilicon
              ? 'arch -arm64 brew install --cask docker'
              : 'brew install --cask docker';

            console.log(chalk.cyan('Please run the following command in a new terminal:'));
            console.log(chalk.white.bold(`\n  ${dockerCommand}\n`));

            console.log(chalk.white('After Docker is installed:'));
            console.log(chalk.white('  1. Open Docker from Applications or Launchpad'));
            console.log(chalk.white(' 2. Accept the terms and conditions'))
            console.log(chalk.white('  3. Wait for Docker to start completely (icon appears in menu bar)'));
            console.log(chalk.white('  4. Return to this installer\n'));

            const { understood } = await inquirer.prompt([{
              type: 'confirm',
              name: 'understood',
              message: 'Have you completed the Docker installation?',
              default: false
            }]);

            if (understood) {
              // Try to verify Docker is now installed
              let dockerReady = false;
              let attempts = 0;
              const maxAttempts = 3;

              while (!dockerReady && attempts < maxAttempts) {
                attempts++;
                try {
                  await execAsync('docker --version');
                  await execAsync('docker info');
                  console.log(chalk.green('✅ Docker is now installed and running!'));
                  dockerReady = true;
                  return; // Continue with the installation flow
                } catch (e) {
                  if (attempts < maxAttempts) {
                    const { retry } = await inquirer.prompt([{
                      type: 'confirm',
                      name: 'retry',
                      message: 'Docker does not appear to be running yet. Would you like to check again?',
                      default: true
                    }]);

                    if (!retry) {
                      console.log(chalk.yellow('\nPlease ensure Docker is running and restart the installer.'));
                      process.exit(0);
                    }

                    console.log(chalk.gray('Waiting a moment for Docker to start...'));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  } else {
                    console.log(chalk.yellow('\nDocker is still not running.'));
                    console.log(chalk.white('Please ensure Docker Desktop is open and running, then restart the installer.'));
                    process.exit(0);
                  }
                }
              }
            } else {
              console.log(chalk.yellow('\nPlease install Docker and run this installer again.'));
              process.exit(0);
            }
          } else {
            console.log(chalk.yellow('Please install Docker from: ') + chalk.cyan.underline('https://www.docker.com/get-started'));
            console.log(chalk.yellow('After installing Docker, make sure it is running and try again.'));
            throw new Error('Docker is not available');
          }
        } catch (brewError) {
          // Brew not installed
          console.log(chalk.red('\n❌ Docker is required for local DreamFactory installation.'));
          console.log(chalk.yellow('Please install Docker from: ') + chalk.cyan.underline('https://www.docker.com/get-started'));
          console.log(chalk.yellow('After installing Docker, make sure it is running and try again.'));
          throw new Error('Docker is not available');
        }
      } else {
        // Not macOS
        console.log(chalk.red('\n❌ Docker is required for local DreamFactory installation.'));
        console.log(chalk.yellow('Please install Docker from: ') + chalk.cyan.underline('https://www.docker.com/get-started'));
        console.log(chalk.yellow('After installing Docker, make sure it is running and try again.'));
        throw new Error('Docker is not available');
      }
    }
  }

  async setupLocalDreamFactory() {
    const spinner = ora('Setting up local DreamFactory...').start();

    try {
      // Check if df-docker directory already exists
      if (await fs.pathExists(this.dockerDir)) {
        spinner.stop(); // Stop spinner before prompt

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: `Directory ${this.dockerDir} already exists. What would you like to do?`,
          choices: [
            { name: 'Use existing installation', value: 'use' },
            { name: 'Remove and reinstall', value: 'reinstall' },
            { name: 'Cancel', value: 'cancel' }
          ]
        }]);

        if (action === 'cancel') {
          throw new Error('Installation cancelled');
        }

        if (action === 'reinstall') {
          spinner.start('Removing existing directory...');
          await fs.remove(this.dockerDir);
        } else {
          // Check if containers are running
          spinner.start('Checking DreamFactory containers...');
          try {
            const { stdout } = await execAsync('docker ps --format "table {{.Names}}" | grep -E "df-mysql|df-redis|df-web"', { cwd: this.dockerDir });
            if (stdout.includes('df-web')) {
              spinner.succeed('DreamFactory containers are already running');
              return;
            }
          } catch (e) {
            // Containers not running, start them
            spinner.text = 'Starting DreamFactory containers...';
            await execAsync('docker compose up -d', { cwd: this.dockerDir });
            await this.waitForDreamFactory();
            spinner.succeed('DreamFactory is running');
            return;
          }
        }
      }

      // Clone df-docker repository
      spinner.text = 'Cloning DreamFactory Docker repository...';
      await execAsync(`git clone https://github.com/dreamfactorysoftware/df-docker.git "${this.dockerDir}"`);

      // Build and start containers
      spinner.text = 'Building Docker images (this may take several minutes on first run)...';

      try {
        // Build with progress output
        spinner.text = 'Building Docker images (this may take 5-10 minutes on first run)...';
        console.log(chalk.gray('\nBuilding containers, please be patient...'));

        const buildResult = await execAsync('docker compose build', {
          cwd: this.dockerDir,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer for build output
        });

        spinner.text = 'Starting DreamFactory containers...';
        await execAsync('docker compose up -d', { cwd: this.dockerDir });
      } catch (error) {
        console.error(chalk.red('\nDocker command failed. Output:'), error.message);
        throw error;
      }

      // Wait for DreamFactory to be ready
      await this.waitForDreamFactory();

      spinner.succeed('Local DreamFactory setup complete');
    } catch (error) {
      spinner.fail('Failed to set up local DreamFactory');
      throw new Error(`Local DreamFactory setup failed: ${error.message}`);
    }
  }

  async waitForDreamFactory() {
    const maxAttempts = 30;
    let attempts = 0;

    const spinner = ora('Waiting for DreamFactory to start...').start();
    const testUrl = 'http://127.0.0.1/';

    while (attempts < maxAttempts) {
      try {
        spinner.text = `Waiting for DreamFactory to start... (attempt ${attempts + 1}/${maxAttempts})`;

        const response = await axios.get(testUrl, {
          timeout: 5000,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'DreamFactory-Installer/1.0'
          }
        });

        // Log the response for debugging if DEBUG_DF_INSTALLER is enabled
        if (process.env.DEBUG_DF_INSTALLER === 'true') {
          console.log(chalk.gray(`\nResponse status: ${response.status}`));
          console.log(chalk.gray(`Response headers: ${JSON.stringify(response.headers, null, 2)}`));
        }

        // The very first invocation of the base DF admin URL will return a 302.
        if (response.status === 200) {
          spinner.succeed('DreamFactory is ready');
          return;
        } else {
          console.log(chalk.yellow(`Unexpected status code: ${response.status}`));
        }

      } catch (error) {
        //console.log(chalk.gray(`\nAttempt ${attempts + 1}: ${error.code || error.message}`));
        if (error.response) {
          console.log(chalk.gray(`Error response status: ${error.response.status}`));
          console.log(chalk.gray(`Error response data: ${JSON.stringify(error.response.data)}`));
        }
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    spinner.fail('DreamFactory failed to start in time');
    throw new Error('DreamFactory failed to start. Please check Docker logs and container status.');
  }

  async cloneAndBuildRepository() {
    const spinner = ora('Cloning DreamFactory MCP repository...').start();

    try {
      // Check if directory already exists
      if (await fs.pathExists(this.installDir)) {
        spinner.stop(); // Stop spinner before prompt

        const { overwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: `Directory ${this.installDir} already exists. Overwrite?`,
          default: false
        }]);

        if (!overwrite) {
          console.log(chalk.blue('ℹ Using existing installation'));
          return;
        }

        spinner.start('Removing existing directory...');
        await fs.remove(this.installDir);
      }

      // Clone repository
      spinner.text = 'Cloning repository...';
      await execAsync(`git clone https://github.com/dreamfactorysoftware/df-mcp.git "${this.installDir}"`);

      // Change to repository directory and install dependencies
      spinner.text = 'Installing dependencies...';
      await execAsync('npm install', { cwd: this.installDir });

      // Build the project
      spinner.text = 'Building project...';
      await execAsync('npm run build', { cwd: this.installDir });

      spinner.succeed('Repository cloned and built successfully');
    } catch (error) {
      spinner.fail('Failed to clone and build repository');
      throw new Error(`Repository setup failed: ${error.message}`);
    }
  }

  async detectClaude() {
    const platform = os.platform();

    try {
      if (platform === 'darwin') {
        // Check if Claude Desktop app exists on macOS
        return await fs.pathExists('/Applications/Claude.app');
      } else if (platform === 'win32') {
        // Check Windows paths for Claude
        const windowsPaths = [
          path.join(os.homedir(), 'AppData', 'Local', 'Claude', 'Claude.exe'),
          path.join('C:', 'Program Files', 'Claude', 'Claude.exe'),
          path.join('C:', 'Program Files (x86)', 'Claude', 'Claude.exe')
        ];

        for (const claudePath of windowsPaths) {
          if (await fs.pathExists(claudePath)) {
            return true;
          }
        }
      } else {
        // Linux - check common installation paths
        const linuxPaths = [
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          path.join(os.homedir(), '.local', 'bin', 'claude')
        ];

        for (const claudePath of linuxPaths) {
          if (await fs.pathExists(claudePath)) {
            return true;
          }
        }
      }
    } catch (error) {
      // Claude not found
    }

    return false;
  }

  async askForClient() {
    const spinner = ora('Checking for Claude Desktop...').start();

    try {
      const claudeInstalled = await this.detectClaude();
      spinner.stop();

      if (!claudeInstalled) {
        console.log(chalk.yellow('⚠️  Claude Desktop not detected.'));
        console.log(chalk.white('Please install Claude Desktop before continuing.'));
        console.log(chalk.white('Download from: https://claude.ai/download'));
        throw new Error('Claude Desktop not found');
      }

      console.log(chalk.blue('ℹ Found Claude Desktop'));
      return 'Claude';
    } catch (error) {
      spinner.fail('Failed to detect Claude Desktop');
      throw error;
    }
  }

  async generateDemoAPI(email, password) {
    const spinner = ora('Generating demo PostgreSQL API...').start();

    try {
      const baseUrl = 'http://127.0.0.1/api/v2';

      // Step 1: Login to get session token
      spinner.text = 'Logging in to DreamFactory...';
      const loginResponse = await axios.post(`${baseUrl}/system/admin/session`, {
        email: email,
        password: password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const sessionToken = loginResponse.data.session_token;
      if (!sessionToken) {
        throw new Error('Failed to obtain session token');
      }

      // Common headers for subsequent requests
      const headers = {
        'X-DreamFactory-Session-Token': sessionToken,
        'Content-Type': 'application/json'
      };

      // Step 2: Check if pgsql service exists, if not create it
      spinner.text = 'Checking for PostgreSQL service...';
      let serviceId;
      try {
        const serviceCheck = await axios.get(`${baseUrl}/system/service`, {
          headers,
          params: { filter: 'name="pgsql"' }
        });
        if (serviceCheck.data.resource && serviceCheck.data.resource.length > 0) {
          serviceId = serviceCheck.data.resource[0].id;
        }
      } catch (error) {
        // Service check failed, will create new one
      }

      if (!serviceId) {
        // Service doesn't exist, create it
        spinner.text = 'Creating PostgreSQL service...';
        const serviceResponse = await axios.post(`${baseUrl}/system/service`, {
          resource: [{
            name: 'pgsql',
            label: 'PostgreSQL Demo',
            description: 'Demo PostgreSQL database',
            is_active: true,
            type: 'pgsql',
            config: {
              driver: 'pgsql',
              host: 'example_data',
              port: 5432,
              database: 'dellstore',
              username: 'postgres',
              password: 'root_pw',
              schema: 'public',
              max_records: 1000
            }
          }]
        }, { headers });
        serviceId = serviceResponse.data.resource[0].id;
      }

      // Step 3: Create RBAC role for pgsql service
      spinner.text = 'Creating RBAC role...';
      const roleResponse = await axios.post(`${baseUrl}/system/role`, {
        resource: [{
          name: 'pgsql_role_' + Date.now(),
          description: 'Role for PostgreSQL demo API access',
          is_active: true,
          role_service_access_by_role_id: [{
            service_id: serviceId,
            component: '*',
            verb_mask: 31, // GET, POST, PUT, PATCH, DELETE (1+2+4+8+16)
            requestor_mask: 1,
            filters: []
          }]
        }]
      }, { headers });

      const roleId = roleResponse.data.resource[0].id;

      // Step 4: Create API key app
      spinner.text = 'Generating API key...';
      const appResponse = await axios.post(`${baseUrl}/system/app`, {
        resource: [{
          name: 'pgsql_app_' + Date.now(),
          description: 'Demo PostgreSQL API application',
          is_active: true,
          type: 0, // API Key app type
          role_id: roleId
        }]
      }, { headers });

      // Debug logging to see response structure
      console.log(chalk.gray('\nDebug - App creation response:'));
      console.log(chalk.gray(JSON.stringify(appResponse.data, null, 2)));

      // Try different ways to get the API key
      let apiKey = appResponse.data.api_key;
      if (!apiKey && appResponse.data.resource && appResponse.data.resource[0]) {
        apiKey = appResponse.data.resource[0].api_key;
      }

      // If still no API key, we need to fetch it separately
      if (!apiKey && appResponse.data.resource && appResponse.data.resource[0] && appResponse.data.resource[0].id) {
        spinner.text = 'Fetching API key...';
        const appId = appResponse.data.resource[0].id;
        const appDetailsResponse = await axios.get(`${baseUrl}/system/app/${appId}`, { headers });

        //console.log(chalk.gray('\nDebug - App details response:'));
        //console.log(chalk.gray(JSON.stringify(appDetailsResponse.data, null, 2)));

        apiKey = appDetailsResponse.data.api_key || appDetailsResponse.data.resource?.api_key;
      }

      if (!apiKey) {
        throw new Error('Failed to obtain API key from app creation');
      }

      spinner.succeed('Demo PostgreSQL API generated successfully');
      return { apiKey, serviceName: 'pgsql' };

    } catch (error) {
      spinner.fail('Failed to generate demo API');

      if (error.response?.status === 401) {
        console.log(chalk.red('Authentication failed. Please check your credentials.'));
      } else if (error.response) {
        console.log(chalk.red(`Error: ${error.response.data?.error?.message || error.message}`));
      } else {
        console.log(chalk.red(`Error: ${error.message}`));
      }

      return null;
    }
  }

  async updateClaudeConfig(apiKey) {
    const spinner = ora('Updating Claude Desktop configuration...').start();

    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.claudeConfigPath);
      await fs.ensureDir(configDir);

      // Read existing config or create new one
      let config = { mcpServers: {} };

      if (await fs.pathExists(this.claudeConfigPath)) {
        try {
          const existingConfig = await fs.readJson(this.claudeConfigPath);
          config = existingConfig;
        } catch (error) {
          spinner.warn('Could not parse existing config, creating new one');
        }
      }

      // Ensure mcpServers exists
      if (!config.mcpServers) {
        config.mcpServers = {};
      }

      // Check if df-mcp already exists
      if (config.mcpServers['df-mcp']) {
        spinner.stop(); // Stop spinner before prompt

        const { update } = await inquirer.prompt([{
          type: 'confirm',
          name: 'update',
          message: 'DreamFactory MCP is already configured. Update configuration?',
          default: true
        }]);

        if (!update) {
          console.log(chalk.blue('ℹ Configuration unchanged'));
          return;
        }

        spinner.start('Updating configuration...');
      }

      // Add or update df-mcp configuration
      config.mcpServers['df-mcp'] = {
        command: 'node',
        args: [
          path.join(this.installDir, 'build', 'index.js')
        ],
        env: {
          DREAMFACTORY_URL: this.dreamfactoryUrl,
          DREAMFACTORY_API_KEY: apiKey
        }
      };

      // Write updated config
      await fs.writeJson(this.claudeConfigPath, config, { spaces: 2 });

      spinner.succeed('Claude Desktop configuration updated');
    } catch (error) {
      spinner.fail('Failed to update Claude Desktop configuration');
      throw new Error(`Configuration update failed: ${error.message}`);
    }
  }
}

module.exports = {
  install: async () => {
    const installer = new DFMCPInstaller();
    await installer.install();
  },
  uninstall: async () => {
    const installer = new DFMCPInstaller();
    await installer.uninstall();
  }
};
