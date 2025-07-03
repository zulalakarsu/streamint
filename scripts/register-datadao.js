const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { createPublicClient, createWalletClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { moksha } = require('viem/chains');

// DLP Registry contract address and ABI
const DLP_REGISTRY_ADDRESS = '0x4D59880a924526d1dD33260552Ff4328b1E18a43';
const DLP_REGISTRY_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "dlpAddress", "type": "address"}],
    "name": "dlpIds",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "dlpName", "type": "string"}],
    "name": "dlpNameToId",
    "outputs": [{"internalType": "uint256", "name": "dlpId", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "dlpAddress",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "ownerAddress",
            "type": "address"
          },
          {
            "internalType": "address payable",
            "name": "treasuryAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "iconUrl",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "website",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "metadata",
            "type": "string"
          }
        ],
        "internalType": "struct IDLPRegistry.DlpRegistration",
        "name": "registrationInfo",
        "type": "tuple"
      }
    ],
    "name": "registerDlp",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

/**
 * Attempt to decode error signature via openchain API
 */
async function decodeErrorSignature(signature) {
  try {
    // Try openchain.xyz API for signature lookup
    const response = await fetch(`https://api.openchain.xyz/signature-database/v1/lookup?function=${signature}&filter=true`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.result && data.result.function && data.result.function.length > 0) {
        const decoded = data.result.function[0].name;
        return `${decoded}`;
      }
    }
  } catch (error) {
    // Fallback silently if API fails
  }

  // Fallback: try to extract from viem error if possible
  return `Unknown error signature: ${signature}`;
}

/**
 * Check if DLP name is already taken
 */
async function checkDlpNameAvailability(dlpName) {
  const client = createPublicClient({
    chain: moksha,
    transport: http('https://rpc.moksha.vana.org')
  });

  try {
    const dlpId = await client.readContract({
      address: DLP_REGISTRY_ADDRESS,
      abi: DLP_REGISTRY_ABI,
      functionName: 'dlpNameToId',
      args: [dlpName]
    });

    const nameExists = Number(dlpId) > 0;
    return {
      available: !nameExists,
      existingId: nameExists ? Number(dlpId) : null
    };
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Could not check name availability: ${error.message}`));
    return { available: true, existingId: null }; // Assume available if check fails
  }
}

/**
 * Get dlpId from the registry automatically
 */
async function getDlpId(dlpAddress) {
  const client = createPublicClient({
    chain: moksha,
    transport: http('https://rpc.moksha.vana.org')
  });

  try {
    const dlpId = await client.readContract({
      address: DLP_REGISTRY_ADDRESS,
      abi: DLP_REGISTRY_ABI,
      functionName: 'dlpIds',
      args: [dlpAddress]
    });

    return Number(dlpId);
  } catch (error) {
    console.error(chalk.red('Error querying dlpId:'), error.message);
    return 0;
  }
}

/**
 * Check wallet balance before registration
 */
async function checkWalletBalance(address) {
  const client = createPublicClient({
    chain: moksha,
    transport: http('https://rpc.moksha.vana.org')
  });

  try {
    const balance = await client.getBalance({ address });
    const balanceInVana = Number(balance) / 1e18;

    console.log(chalk.blue('💰 Wallet Information:'));
    console.log(`  Address: ${address}`);
    console.log(`  Balance: ${balanceInVana.toFixed(4)} VANA`);
    console.log();

    if (balanceInVana < 1.1) {
      console.error(chalk.red('❌ Insufficient balance for registration!'));
      console.error(chalk.yellow('Registration requires 1 VANA + gas fees (recommend at least 1.1 VANA)'));
      console.error(chalk.yellow('Please fund your wallet from https://faucet.vana.org'));
      console.error(chalk.yellow(`Your wallet address: ${address}`));
      return false;
    }

    console.log(chalk.green('✅ Wallet has sufficient balance for registration'));
    return true;
  } catch (error) {
    console.error(chalk.yellow(`⚠️  Could not check wallet balance: ${error.message}`));
    console.log(chalk.yellow('Proceeding with registration...'));
    return true;
  }
}

/**
 * ENHANCEMENT: Perform automated registration
 */
async function performAutomatedRegistration(deployment, quickMode = false) {
  console.log(chalk.blue('⚡ Starting automated registration...'));
  console.log();

  // Load private key from contracts .env
  const contractsEnvPath = path.join(process.cwd(), 'contracts', '.env');
  if (!fs.existsSync(contractsEnvPath)) {
    console.error(chalk.red('No contracts/.env file found. Cannot access private key.'));
    throw new Error('No contracts/.env file found. Cannot access private key.');
  }

  const envContent = fs.readFileSync(contractsEnvPath, 'utf8');
  const privateKeyMatch = envContent.match(/DEPLOYER_PRIVATE_KEY=(.+)/);

  if (!privateKeyMatch) {
    console.error(chalk.red('No DEPLOYER_PRIVATE_KEY found in contracts/.env'));
    throw new Error('No DEPLOYER_PRIVATE_KEY found in contracts/.env');
  }

  const privateKey = privateKeyMatch[1].trim();

  try {
    // Create account and clients
    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: moksha,
      transport: http('https://rpc.moksha.vana.org')
    });

    const walletClient = createWalletClient({
      account,
      chain: moksha,
      transport: http('https://rpc.moksha.vana.org')
    });

    // Check balance
    const hasBalance = await checkWalletBalance(account.address);
    if (!hasBalance) {
      throw new Error('Insufficient wallet balance for registration');
    }

    // Get the DLP proxy address (supports both old and new format)
    const dlpProxyAddress = deployment.proxyAddress ||
                           (deployment.contracts && deployment.contracts.proxyAddress) ||
                           deployment.dlpAddress;

    if (!dlpProxyAddress) {
      console.error(chalk.red('❌ DLP proxy address not found in deployment.json'));
      console.error(chalk.yellow('Please ensure contracts are deployed first.'));
      throw new Error('DLP proxy address not found in deployment.json');
    }

    // Prepare registration parameters
    const registrationParams = {
      dlpAddress: dlpProxyAddress,
      ownerAddress: deployment.address,
      treasuryAddress: deployment.address,
      name: deployment.dlpName,
      iconUrl: '',
      website: '',
      metadata: ''
    };

    console.log(chalk.blue('📋 Registration Parameters:'));
    console.log(`  DLP Address: ${registrationParams.dlpAddress}`);
    console.log(`  Owner: ${registrationParams.ownerAddress}`);
    console.log(`  Treasury: ${registrationParams.treasuryAddress}`);
    console.log(`  Name: ${registrationParams.name}`);
    console.log(`  Registration Fee: 1 VANA`);
    console.log();

    // Skip confirmation in quick mode
    if (!quickMode) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Proceed with automated registration?',
          default: true
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Registration cancelled.'));
        throw new Error('Registration cancelled by user');
      }
    }

    console.log(chalk.blue('🚀 Submitting registration transaction...'));

    // Call registerDlp function
    const hash = await walletClient.writeContract({
      address: DLP_REGISTRY_ADDRESS,
      abi: DLP_REGISTRY_ABI,
      functionName: 'registerDlp',
      args: [
        {
          dlpAddress: registrationParams.dlpAddress,
          ownerAddress: registrationParams.ownerAddress,
          treasuryAddress: registrationParams.treasuryAddress,
          name: registrationParams.name,
          iconUrl: registrationParams.iconUrl,
          website: registrationParams.website,
          metadata: registrationParams.metadata
        }
      ],
      value: parseEther('1') // 1 VANA registration fee
    });

    console.log(chalk.blue(`📝 Transaction submitted: ${hash}`));
    console.log(chalk.blue('⏳ Waiting for confirmation...'));

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(chalk.green('✅ Registration transaction confirmed!'));
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
      console.log();

      // Get the dlpId
      console.log(chalk.blue('🔍 Retrieving dlpId...'));
      const dlpId = await getDlpId(dlpProxyAddress);

      if (dlpId > 0) {
        console.log(chalk.green(`✅ Registration successful! dlpId: ${dlpId}`));
        deployment.dlpId = dlpId;
        deployment.state = deployment.state || {};
        deployment.state.dataDAORegistered = true;

        // Save deployment.json immediately with error handling
        const deploymentPath = path.join(process.cwd(), 'deployment.json');
        try {
          fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
          console.log(chalk.blue(`📝 Saved dlpId ${dlpId} to ${deploymentPath}`));
        } catch (saveError) {
          console.error(chalk.red(`❌ Failed to save dlpId to deployment.json: ${saveError.message}`));
          console.error(chalk.yellow(`Please manually add "dlpId": ${dlpId} to deployment.json`));
          // Still return true since registration succeeded
        }

        return true;
      } else {
        console.error(chalk.red('Registration transaction succeeded but could not retrieve dlpId'));
        console.log(chalk.yellow('Please check the transaction and try querying dlpId manually'));
        throw new Error('Registration transaction succeeded but could not retrieve dlpId');
      }
    } else {
      console.error(chalk.red('❌ Registration transaction failed'));
      console.log(`   Transaction hash: ${hash}`);
      throw new Error(`Registration transaction failed. Hash: ${hash}`);
    }

  } catch (error) {
    console.error(chalk.red('Registration failed:'), error.message);

    // Try to decode error signature
    const signatureMatch = error.message.match(/0x[0-9a-fA-F]{8}/);
    if (signatureMatch) {
      const signature = signatureMatch[0];
      try {
        const decodedError = await decodeErrorSignature(signature);
        console.error(chalk.yellow(`\n💡 Decoded error: ${decodedError}`));
      } catch (decodeError) {
        console.error(chalk.yellow(`\n💡 Error signature: ${signature} (could not decode)`));
      }
    }

    // Comprehensive error analysis
    const errorLower = error.message.toLowerCase();
    let recoverySteps = [];
    let canRetry = false;

    if (errorLower.includes('insufficient funds') || errorLower.includes('insufficient_funds')) {
      console.error(chalk.yellow('\n💡 Insufficient funds detected'));
      console.error(chalk.yellow('Registration requires 1 VANA + gas fees (~1.1 VANA total)'));
      recoverySteps = [
        'Check balance: https://moksha.vanascan.io/address/' + deployment.address,
        'Get testnet VANA: https://faucet.vana.org',
        'Wait 1-2 minutes for funds to arrive',
        'Retry registration: npm run register:datadao'
      ];
    } else if (errorLower.includes('user rejected') || errorLower.includes('user denied')) {
      console.error(chalk.yellow('\n💡 Transaction cancelled by user'));
      canRetry = true;
      recoverySteps = [
        'No action needed - you cancelled the transaction',
        'Retry when ready: npm run register:datadao'
      ];
    } else if (errorLower.includes('already registered') || errorLower.includes('dlp exists') || 
               errorLower.includes('invalidname') || errorLower.includes('name') && errorLower.includes('taken')) {
      console.error(chalk.yellow('\n💡 DataDAO name conflict detected'));
      recoverySteps = [
        'Check registration on Vanascan: https://moksha.vanascan.io/address/' + dlpProxyAddress,
        'If registered, run: npm run status to update local state',
        'Otherwise, check existing DataDAO names: https://moksha.vanascan.io/address/0x4D59880a924526d1dD33260552Ff4328b1E18a43',
        'Edit deployment.json and change "dlpName" to something unique',
        'Retry registration after changing the name'
      ];
    } else if (errorLower.includes('reverted') || errorLower.includes('execution failed')) {
      console.error(chalk.yellow('\n💡 Transaction was reverted by the network'));
      recoverySteps = [
        'Verify contract deployment succeeded: npm run status',
        'Check DLP proxy address is correct in deployment.json',
        'Ensure you\'re using the proxy address, not implementation',
        'Try manual registration via Vanascan'
      ];
    } else if (errorLower.includes('nonce') || errorLower.includes('already known')) {
      console.error(chalk.yellow('\n💡 Transaction nonce conflict detected'));
      canRetry = true;
      recoverySteps = [
        'Wait 30 seconds for pending transactions',
        'Check recent transactions: https://moksha.vanascan.io/address/' + deployment.address,
        'Retry registration: npm run register:datadao'
      ];
    } else if (errorLower.includes('timeout') || errorLower.includes('network')) {
      console.error(chalk.yellow('\n💡 Network connectivity issue'));
      canRetry = true;
      recoverySteps = [
        'Check your internet connection',
        'Wait 2-3 minutes for network congestion',
        'Retry registration: npm run register:datadao'
      ];
    } else {
      console.error(chalk.yellow('\n💡 Unexpected error occurred'));
      recoverySteps = [
        'Check the full error message above',
        'Verify deployment.json has correct addresses',
        'Try manual registration via Vanascan',
        'Contact support if issue persists'
      ];
    }

    // Display recovery steps
    console.error(chalk.cyan('\n📋 Recovery Steps:'));
    recoverySteps.forEach((step, index) => {
      console.error(chalk.white(`${index + 1}. ${step}`));
    });

    if (canRetry) {
      console.error(chalk.cyan('\n🔄 This error is likely temporary and can be retried.'));
    }

    // Offer alternative registration method
    console.error(chalk.cyan('\n🌐 Alternative: Manual Registration'));
    console.error(chalk.white('You can also register manually via Vanascan:'));
    console.error(chalk.blue('https://moksha.vanascan.io/address/0x4D59880a924526d1dD33260552Ff4328b1E18a43?tab=write_proxy'));

    throw error; // Re-throw the original error
  }
}

/**
 * PRESERVED: Manual registration flow
 */
async function performManualRegistration(deployment) {
  // Get the DLP proxy address (supports both old and new format)
  const dlpProxyAddress = deployment.proxyAddress ||
                         (deployment.contracts && deployment.contracts.proxyAddress) ||
                         deployment.dlpAddress;

  console.log();
  console.log(chalk.yellow('🔗 Manual Registration Steps:'));
  console.log('1. Go to https://moksha.vanascan.io/address/0x4D59880a924526d1dD33260552Ff4328b1E18a43?tab=write_proxy');
  console.log('2. Connect your wallet');
  console.log('3. Find the "registerDlp" method');
  console.log('4. Fill in the registration info:');
  console.log(`   - dlpAddress: ${dlpProxyAddress}`);
  console.log(`   - ownerAddress: ${deployment.address}`);
  console.log(`   - treasuryAddress: ${deployment.address}`);
  console.log(`   - name: ${deployment.dlpName}`);
  console.log('   - iconUrl: (optional)');
  console.log('   - website: (optional)');
  console.log('   - metadata: (optional)');
  console.log('5. Set "Send native VANA" to 1 (click ×10^18 button)');
  console.log('6. Submit the transaction');
  console.log('7. View the transaction logs for the created dlpId. Track this for later use');
  console.log('8. Add the dlpId to your deployment.json (ie. "dlpId": 123,)');
  console.log();

  const { completed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'completed',
      message: 'Have you completed the registration transaction?',
      default: false
    }
  ]);

  if (!completed) {
    // Instead of exiting, offer options to continue
    while (true) {
      const { manualAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'manualAction',
          message: 'What would you like to do?',
          choices: [
            { name: '✅ I\'ve completed it now', value: 'completed' },
            { name: '🔄 Show me the instructions again', value: 'instructions' },
            { name: '💡 I need help with the registration', value: 'help' },
            { name: '⚡ Switch to automated registration', value: 'auto' },
            { name: '⏸️  Skip registration for now', value: 'skip' }
          ]
        }
      ]);

      if (manualAction === 'completed') {
        break; // Continue with dlpId detection
      } else if (manualAction === 'instructions') {
        console.log();
        console.log(chalk.yellow('🔗 Manual Registration Steps:'));
        console.log('1. Go to https://moksha.vanascan.io/address/0x4D59880a924526d1dD33260552Ff4328b1E18a43?tab=write_proxy');
        console.log('2. Connect your wallet');
        console.log('3. Find the "registerDlp" method');
        console.log('4. Fill in the registration info:');
        console.log(`   - dlpAddress: ${dlpProxyAddress}`);
        console.log(`   - ownerAddress: ${deployment.address}`);
        console.log(`   - treasuryAddress: ${deployment.address}`);
        console.log(`   - name: ${deployment.dlpName}`);
        console.log('   - iconUrl: (optional)');
        console.log('   - website: (optional)');
        console.log('   - metadata: (optional)');
        console.log('5. Set "Send native VANA" to 1 (click ×10^18 button)');
        console.log('6. Submit the transaction');
        console.log();
      } else if (manualAction === 'help') {
        console.log();
        console.log(chalk.blue('💡 Registration Help:'));
        console.log('• Make sure you have at least 1.1 VANA in your wallet');
        console.log('• Use MetaMask or another Web3 wallet to connect');
        console.log('• The dlpAddress should be the proxy address (not implementation)');
        console.log('• Double-check all addresses match your deployment.json');
        console.log('• If you get errors, try refreshing the page and reconnecting');
        console.log();
              } else if (manualAction === 'auto') {
          console.log(chalk.blue('Switching to automated registration...'));
          return await performAutomatedRegistration(deployment);
        } else if (manualAction === 'skip') {
          console.log(chalk.yellow('Registration skipped. You can register later with: npm run register:datadao'));
          throw new Error('Registration skipped by user');
        }
    }
  }

  // Auto-detect dlpId after manual registration
  console.log();
  console.log(chalk.blue('🔍 Detecting your dlpId...'));

  // Poll for dlpId (it might take a moment for the transaction to be processed)
  let dlpId = 0;
  for (let i = 0; i < 10; i++) {
    dlpId = await getDlpId(dlpProxyAddress);
    if (dlpId > 0) break;

    console.log(`   Attempt ${i + 1}/10: Waiting for registration to be processed...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  if (dlpId === 0) {
    console.error(chalk.red('Could not detect dlpId automatically.'));

    // Instead of exiting, offer retry options
    while (true) {
      const { retryAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'retryAction',
          message: 'What would you like to do?',
          choices: [
            { name: '🔄 Try detecting dlpId again', value: 'retry' },
            { name: '🔍 Check transaction status', value: 'check' },
            { name: '📝 Enter dlpId manually', value: 'manual' },
            { name: '⚡ Try automated registration instead', value: 'auto' },
            { name: '⏸️  Skip for now', value: 'skip' }
          ]
        }
      ]);

      if (retryAction === 'retry') {
        console.log(chalk.blue('🔍 Retrying dlpId detection...'));
        for (let i = 0; i < 5; i++) {
          dlpId = await getDlpId(dlpProxyAddress);
          if (dlpId > 0) break;
          console.log(`   Attempt ${i + 1}/5: Waiting for registration to be processed...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (dlpId > 0) {
          break; // Success!
        } else {
          console.log(chalk.yellow('Still no dlpId detected. Transaction may need more time.'));
        }
      } else if (retryAction === 'check') {
        console.log();
        console.log(chalk.blue('💡 Check your transaction:'));
        console.log(`• Wallet transactions: https://moksha.vanascan.io/address/${deployment.address}`);
        console.log(`• DLP contract: https://moksha.vanascan.io/address/${dlpProxyAddress}`);
        console.log('• Look for a recent "registerDlp" transaction');
        console.log();
      } else if (retryAction === 'manual') {
        const { manualDlpId } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualDlpId',
            message: 'Enter your dlpId (number):',
            validate: (input) => {
              const num = parseInt(input);
              return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
            }
          }
        ]);
        dlpId = parseInt(manualDlpId);
        break;
      } else if (retryAction === 'auto') {
        console.log(chalk.blue('Switching to automated registration...'));
        return await performAutomatedRegistration(deployment);
              } else if (retryAction === 'skip') {
          console.log(chalk.yellow('Registration incomplete. You can try again later with: npm run register:datadao'));
          throw new Error('Registration incomplete - skipped by user');
        }
    }
  }

  console.log(chalk.green(`✅ dlpId detected: ${dlpId}`));
  console.log();
  console.log(chalk.yellow('📝 Manual Registration Complete'));
  console.log(`Please add the following to your deployment.json file:`);
  console.log(chalk.cyan(`  "dlpId": ${dlpId},`));
  console.log(`And update the registration state:`);
  console.log(chalk.cyan(`  "dataDAORegistered": true`));
  console.log();
  console.log(chalk.blue('💡 Or run: npm run status to automatically detect and update'));
  
  // Don't automatically update the file - let user handle it manually
  return true;
}

/**
 * Register DataDAO with BOTH automated AND manual options
 */
async function registerDataDAO() {
  console.log(chalk.blue('📋 DataDAO Registration'));
  console.log();

  // Load deployment info
  const deploymentPath = path.join(process.cwd(), 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error(chalk.red('No deployment.json found. Please deploy contracts first.'));
    throw new Error('No deployment.json found. Please deploy contracts first.');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  // Detect quick mode from environment or deployment config
  const quickMode = process.env.QUICK_MODE === 'true' || deployment.quickMode === true;

  // Get the DLP proxy address (supports both old and new format)
  const dlpProxyAddress = deployment.proxyAddress ||
                         (deployment.contracts && deployment.contracts.proxyAddress) ||
                         deployment.dlpAddress;

  if (!dlpProxyAddress) {
    console.error(chalk.red('No DLP proxy address found. Please deploy contracts first.'));
    throw new Error('No DLP proxy address found. Please deploy contracts first.');
  }

  console.log(chalk.blue('📋 Registration Information:'));
  console.log(`  DLP Address: ${dlpProxyAddress}`);
  console.log(`  Owner Address: ${deployment.address}`);
  console.log(`  DLP Name: ${deployment.dlpName}`);
  console.log();

  // Check if already registered
  console.log(chalk.blue('🔍 Checking registration status...'));
  const existingDlpId = await getDlpId(dlpProxyAddress);

  if (existingDlpId > 0) {
    console.log(chalk.green(`✅ DataDAO already registered with dlpId: ${existingDlpId}`));
    deployment.dlpId = existingDlpId;
    deployment.state = deployment.state || {};
    deployment.state.dataDAORegistered = true;
    
    try {
      fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
      console.log(chalk.blue(`📝 Updated deployment.json with dlpId: ${existingDlpId}`));
    } catch (saveError) {
      console.error(chalk.red(`❌ Failed to save dlpId to deployment.json: ${saveError.message}`));
      console.error(chalk.yellow(`Please manually add "dlpId": ${existingDlpId} to deployment.json`));
    }

    console.log();
    console.log(chalk.blue('🎯 Your DataDAO is registered and ready!'));
    console.log('Next: Configure your proof template and refiner');
    return; // Success case - don't throw
  }

  console.log(chalk.yellow('⏸️  DataDAO not yet registered'));
  console.log();

  // Check if the DLP name is already taken BEFORE attempting registration
  console.log(chalk.blue('🔍 Checking DLP name availability...'));
  const nameCheck = await checkDlpNameAvailability(deployment.dlpName);

  if (!nameCheck.available) {
    console.error(chalk.red(`❌ DLP name "${deployment.dlpName}" is already taken (dlpId: ${nameCheck.existingId})`));
    console.error(chalk.yellow('   You need to choose a different name for your DataDAO.'));
    console.log();

    recoverySteps = [
      'Check registration on Vanascan: https://moksha.vanascan.io/address/' + dlpProxyAddress,
      'If registered, run: npm run status to update local state',
      'Otherwise, check existing DataDAO names: https://moksha.vanascan.io/address/0x4D59880a924526d1dD33260552Ff4328b1E18a43',
      'Edit deployment.json and change "dlpName" to something unique',
      'Retry registration after changing the name'
    ];

    // Display recovery steps
    console.error(chalk.cyan('\n📋 Recovery Steps:'));
    recoverySteps.forEach((step, index) => {
      console.error(chalk.white(`${index + 1}. ${step}`));
    });
    console.log();
    
    throw new Error(`DLP name "${deployment.dlpName}" is already taken (dlpId: ${nameCheck.existingId})`);
  }

  console.log(chalk.green(`✅ DLP name "${deployment.dlpName}" is available`));
  console.log();

  let registrationMethod = 'auto'; // Default to auto

  // In quick mode, skip the selection and go straight to automated registration
  if (!quickMode) {
    console.log(chalk.blue('📋 Registration Options:'));
    console.log();

    const { method } = await inquirer.prompt([
      {
        type: 'list',
        name: 'method',
        message: 'How would you like to register your DataDAO?',
        choices: [
          { name: '⚡ Automated registration (recommended)', value: 'auto' },
          { name: '🌐 Manual registration via Vanascan', value: 'manual' },
          { name: '⏸️  Skip for now', value: 'skip' }
        ]
      }
    ]);

    registrationMethod = method;

    if (registrationMethod === 'skip') {
      console.log(chalk.yellow('Registration skipped.'));

      // Instead of just returning, offer to continue later
      while (true) {
        const { skipAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'skipAction',
            message: 'What would you like to do?',
            choices: [
              { name: '🚀 Actually, let\'s register now', value: 'register' },
              { name: '📋 Show me what registration does', value: 'explain' },
              { name: '⏸️  Skip for now and continue setup', value: 'continue' }
            ]
          }
        ]);

        if (skipAction === 'register') {
          // Go back to registration method selection
          const { newMethod } = await inquirer.prompt([
            {
              type: 'list',
              name: 'newMethod',
              message: 'How would you like to register your DataDAO?',
              choices: [
                { name: '⚡ Automated registration (recommended)', value: 'auto' },
                { name: '🌐 Manual registration via Vanascan', value: 'manual' }
              ]
            }
          ]);
          registrationMethod = newMethod;
          break;
        } else if (skipAction === 'explain') {
          console.log();
          console.log(chalk.blue('🔍 What does registration do?'));
          console.log('• Registers your DataDAO on the Vana network');
          console.log('• Assigns a unique dlpId to your DataDAO');
          console.log('• Enables users to find and contribute to your DataDAO');
          console.log('• Required for production use');
          console.log('• Costs 1 VANA + gas fees');
          console.log();
        } else {
          console.log(chalk.yellow('You can register later with: npm run register:datadao'));
          throw new Error('Registration skipped by user');
        }
      }
    }
  }

  let registrationSuccessful = false;

  if (registrationMethod === 'auto') {
    registrationSuccessful = await performAutomatedRegistration(deployment, quickMode);
  } else if (registrationMethod === 'manual') {
    registrationSuccessful = await performManualRegistration(deployment);
  }

  if (registrationSuccessful) {
    console.log();
    console.log(chalk.green('✅ DataDAO registration completed!'));
    console.log();
    console.log(chalk.blue('🎯 What happens next:'));
    console.log('• Update your proof template with the dlpId');
    console.log('• Get the encryption key for your refiner');
    console.log('• Configure your proof-of-contribution logic');
    console.log('• Test the full data contribution flow');
  } else {
    // If registration was not successful, throw an error
    throw new Error(`${registrationMethod === 'auto' ? 'Automated' : 'Manual'} registration failed`);
  }
}

// Run registration
registerDataDAO().catch(error => {
  console.error(chalk.red('Registration failed:'), error.message);
  process.exit(1);
});