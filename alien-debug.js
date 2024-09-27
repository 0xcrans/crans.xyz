// Constants and Configuration
const NETWORK_CONFIG = {
    networkId: 'mainnet',
    nodeUrl: 'https://free.rpc.fastnear.com/',
    walletUrl: 'https://app.mynearwallet.com/',
    contractId: 'aliendebug.near',
    cransContractId: 'crans.tkn.near'
};

const GAME_STATES = {
    INITIAL: 'initial',
    PLAYING: 'playing',
    ENDED: 'ended',
    CLAIMING: 'claiming',
    CLAIMED: 'claimed'
};

// Initialization
let near;
let wallet;
let contract;
let gameArea, scoreDisplay;
let score = 0;
let difficulty = 5;
let gameActive = false;

// Function to initialize NEAR connection and wallet
async function initNearConnection() {
    near = await nearApi.connect({
        networkId: NETWORK_CONFIG.networkId,
        keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore(),
        nodeUrl: NETWORK_CONFIG.nodeUrl,
        walletUrl: NETWORK_CONFIG.walletUrl,
    });
    wallet = new nearApi.WalletConnection(near, 'alien-debug');
}

// Function to initialize contract
async function initContract() {
    try {
        contract = new nearApi.Contract(
            wallet.account(),
            NETWORK_CONFIG.contractId,
            {
                viewMethods: [
                    'get_claimed_rewards',
                    'get_reward_amount',
                    'is_initialized',
                    'get_crans_token'
                ],
                changeMethods: [
                    'claim_reward',
                    'set_reward_amount',
                    'reinitialize'
                ]
            }
        );
        console.log("Contract initialized successfully");
    } catch (error) {
        console.error("Error initializing contract:", error);
        showCustomAlert("Failed to initialize the game contract. Please try again later.");
    }
}

// Helper functions
function formatAccountId(accountId) {
    if (accountId.length > 32) {
        return `${accountId.slice(0, 4)}...${accountId.slice(-4)}`;
    }
    return accountId;
}

function getTransactionHashFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('transactionHashes');
}

function setGameState(state) {
    localStorage.setItem('gameState', state);
}

function getGameState() {
    return localStorage.getItem('gameState') || GAME_STATES.INITIAL;
}

// For alien-debug.js (paste.txt)

function showLoadingScreen(show) {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    if (loader && content) {
        if (show) {
            loader.style.opacity = '1';
            loader.style.display = 'flex';
            content.style.opacity = '0';
        } else {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                content.style.opacity = '1';
                content.classList.add('visible');
            }, 500);
        }
    }
}

async function initialSetup() {
    console.log("Initial setup started");
    showLoadingScreen(true);
    try {
        await initNearConnection();
        console.log("NEAR connection initialized");
        setupEventListeners();
        console.log("Event listeners set up");
        await initializeGame();
        console.log("Game initialization completed");
    } catch (error) {
        console.error("Error during initial setup:", error);
        showCustomAlert("Failed to initialize the game. Please try again later.");
    } finally {
        showLoadingScreen(false);
    }
}

document.addEventListener('DOMContentLoaded', initialSetup);

function showLoadingScreen(show) {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    
    if (loader && content) {
        if (show) {
            loader.style.display = 'flex';
            content.style.display = 'none';
        } else {
            loader.style.display = 'none';
            content.style.display = 'block'; // Ensure 'block' is applied before animations
            setTimeout(() => {
                content.classList.add('visible'); // This line should not throw errors
            }, 50);  // Ensure there's a slight delay for visibility transition
        }
    }
}


function updateButtonVisibility(isConnected) {
    const connectButton = document.getElementById('connect-wallet');
    const registerButton = document.getElementById('register-crans');
    const startButton = document.getElementById('start-game');
    const disconnectButton = document.getElementById('disconnect-wallet');
    const introMessage = document.getElementById('intro-message');
    const walletInfo = document.getElementById('wallet-info');

    if (connectButton) connectButton.style.display = isConnected ? 'none' : 'inline-block';
    if (registerButton) registerButton.style.display = isConnected ? 'inline-block' : 'none';
    if (startButton) startButton.style.display = isConnected ? 'inline-block' : 'none';
    if (disconnectButton) disconnectButton.style.display = isConnected ? 'inline-block' : 'none';
    if (introMessage) introMessage.style.display = isConnected ? 'none' : 'block'; // Hide intro when connected
    if (walletInfo) walletInfo.style.display = isConnected ? 'block' : 'none';
}

async function fetchCRANSBalance(accountId) {
    try {
        const tokenData = await wallet.account().viewFunction(
            NETWORK_CONFIG.cransContractId,
            "ft_balance_of",
            { account_id: accountId }  // Correct parameter for the balance method
        );
        console.log("Raw CRANS token data:", tokenData);

        if (tokenData) {
            // Convert the balance from yoctoNEAR (10^-24) to NEAR
            const formattedBalance = nearApi.utils.format.formatNearAmount(tokenData, 8);
            return formattedBalance;
        } else {
            return "0";
        }
    } catch (error) {
        console.error("Error fetching CRANS balance:", error);
        return "N/A";
    }
}

async function fetchAccountDetails(accountId) {
    try {
        const account = await wallet.account();
        const balance = await account.getAccountBalance();
        console.log("Raw account balance:", balance);
        
        const formattedBalance = nearApi.utils.format.formatNearAmount(balance.available, 5);
        return {
            accountId: accountId,
            balance: formattedBalance
        };
    } catch (error) {
        console.error("Error fetching account details:", error);
        return {
            accountId: accountId,
            balance: "Error"
        };
    }
}

async function updateGameDisplay() {
    const walletInfo = document.getElementById('wallet-info');
    if (!walletInfo) {
        console.error("Wallet details element not found");
        return;
    }

    const isSignedIn = wallet.isSignedIn();
    
    if (isSignedIn) {
        const accountId = wallet.getAccountId();
        const formattedAccountId = formatAccountId(accountId); // Use the formatting function here
        try {
            const accountDetails = await fetchAccountDetails(accountId);
            const cransBalance = await fetchCRANSBalance(accountId);
            
            let infoText = `Connected as: ${formattedAccountId}<br>`; // Use the formatted account ID
            infoText += `${accountDetails.balance} NEAR<br>`;
            infoText += `${cransBalance} CRANS`;
            
            walletInfo.innerHTML = infoText;
            walletInfo.style.display = 'block';
        } catch (error) {
            console.error("Error updating game display:", error);
            walletInfo.innerHTML = "Error fetching account information";
        }
    } else {
        walletInfo.innerHTML = '';
        walletInfo.style.display = 'none';
    }

    updateButtonVisibility(isSignedIn);
}

function createAlienMonster() {
    const alienMonster = document.createElement('div');
    alienMonster.className = 'alien-monster';
    alienMonster.textContent = '👾';
    moveAlienMonster(alienMonster);
    alienMonster.addEventListener('click', (e) => {
        e.stopPropagation();
        catchAlienMonster(alienMonster);
    });
    gameArea.appendChild(alienMonster);
    return alienMonster;
}

function moveAlienMonster(alienMonster) {
    const maxX = gameArea.clientWidth - 30;
    const maxY = gameArea.clientHeight - 30;
    alienMonster.style.left = `${Math.floor(Math.random() * maxX)}px`;
    alienMonster.style.top = `${Math.floor(Math.random() * maxY)}px`;
}

function updateScore() {
    scoreDisplay.textContent = `Alien monsters caught: ${score} / 10`;
}

function catchAlienMonster(alienMonster) {
    if (!gameActive || score >= 10) return;

    score++;
    updateScore();
    alienMonster.style.pointerEvents = 'none';
    alienMonster.style.opacity = '0.5';

    if (score >= 10) {
        endGame();
    } else {
        createAlienMonster();
        difficulty += 0.5;
    }
}

function missAlienMonster() {
    difficulty = Math.max(3, difficulty - 0.1);
}

function endGame() {
    gameActive = false;
    setGameState(GAME_STATES.ENDED);
    showCustomAlert("These bloody aliens are gone now! I don't know how the hell they all got here... Anyway, I have a reward for you! Hope you have registered $CRANS first!", false, false, true);

    document.getElementById('intro-message').style.display = 'none';
    gameArea.style.display = 'none';
    document.getElementById('register-crans').style.display = 'inline-block';
    document.getElementById('start-game').style.display = 'inline-block';
    document.getElementById('disconnect-wallet').style.display = 'inline-block';
    document.getElementById('wallet-info').style.display = 'block';
    scoreDisplay.style.display = 'none';
}

function startGame() {
    gameActive = true;
    score = 0;
    
    gameArea = document.getElementById('game-area');
    scoreDisplay = document.getElementById('score');
    
    updateScore();
    document.getElementById('intro-message').style.display = 'none'; // Hide intro message when game starts
    gameArea.style.display = 'block';
    scoreDisplay.style.display = 'block';
    document.getElementById('register-crans').style.display = 'none';
    document.getElementById('start-game').style.display = 'none';
    document.getElementById('disconnect-wallet').style.display = 'none';
    document.getElementById('wallet-info').style.display = 'none';
    gameArea.innerHTML = '';
    createAlienMonster();
    setGameState(GAME_STATES.PLAYING);
    document.querySelector('.content-section h1').textContent = "ALIEN DEBUG";
}

async function connectWallet() {
    if (!wallet.isSignedIn()) {
        try {
            await wallet.requestSignIn({
                contractId: NETWORK_CONFIG.contractId,
                successUrl: window.location.href,
                failureUrl: window.location.href
            });
        } catch (e) {
            console.error("Error during wallet connection:", e);
            showCustomAlert("Failed to connect to the wallet. Please try again.", true);
        }
    }
    if (wallet.isSignedIn()) {
        showLoadingScreen(true);
        await initializeGame();
        
        // Hide intro message after successful wallet connection
        const introMessage = document.getElementById('intro-message');
        if (introMessage) {
            introMessage.style.display = 'none';
        }
        
        showLoadingScreen(false);
    }
}

function disconnectWallet() {
    wallet.signOut();
    setGameState(GAME_STATES.INITIAL);
    updateGameDisplay();
    localStorage.removeItem('claimInProgress');
    
    const url = new URL(window.location);
    url.searchParams.delete('transactionHashes');
    window.history.replaceState({}, '', url);
}

function setCRANSRegistrationAttempt() {
    localStorage.setItem('cransRegistrationAttempt', 'true');
}

async function registerCRANS() {
    if (!wallet.isSignedIn()) {
        showCustomAlert("Please connect your wallet first.");
        return;
    }

    try {
        const functionCallOptions = {
            contractId: NETWORK_CONFIG.cransContractId,
            methodName: "storage_deposit",
            args: {},
            gas: "100000000000000",
            attachedDeposit: nearApi.utils.format.parseNearAmount("0.00125")
        };

        setCRANSRegistrationAttempt();
        await wallet.account().functionCall(functionCallOptions);
        showCustomAlert("$CRANS registration successful.");
    } catch (error) {
        console.error("Error in CRANS registration:", error);
        showCustomAlert("There was an error during $CRANS registration. Please try again.");
    }
}

async function claimReward() {
    if (!wallet.isSignedIn()) {
        showCustomAlert("Please connect your wallet first.");
        return;
    }

    const accountId = wallet.getAccountId();

    try {
        console.log("Starting claim reward process...");
        const timestamp = Date.now() * 1000000;
        const gameProof = {
            account_id: accountId,
            timestamp: timestamp,
            captured_monsters: 10
        };

        const gameProofString = JSON.stringify(gameProof);
        const gameProofBase64 = btoa(gameProofString);

        setGameState(GAME_STATES.CLAIMING);
        console.log("Game state set to CLAIMING");

        localStorage.setItem('claimInProgress', 'true');

        console.log("Calling claim_reward function...");
        const result = await contract.claim_reward({ game_proof: gameProofBase64 });
        console.log("claim_reward function call result:", result);

        // If we reach this point, the transaction was successful
        showCustomAlert("Reward claimed successfully! Refresh the page or check your wallet for $CRANS.");
        setGameState(GAME_STATES.CLAIMED);
    } catch (error) {
        console.error("Error in claim reward process:", error);
        showCustomAlert("There was an error processing your request. Please try again.");
        setGameState(GAME_STATES.ENDED);
    } finally {
        localStorage.removeItem('claimInProgress');
    }
}

async function checkClaimStatus() {
    if (!wallet.isSignedIn()) {
        console.log("Wallet is not connected. Skipping claim status check.");
        return;
    }

    const claimInProgress = localStorage.getItem('claimInProgress');
    const txHash = getTransactionHashFromURL();

    if (claimInProgress === 'true' || txHash) {
        try {
            let transactionResult;
            if (txHash) {
                const provider = new nearApi.providers.JsonRpcProvider(NETWORK_CONFIG.nodeUrl);
                transactionResult = await provider.txStatus(txHash, wallet.getAccountId());
                
                if (transactionResult.transaction.signer_id !== wallet.getAccountId()) {
                    console.log("Transaction does not belong to the current wallet. Skipping claim status check.");
                    return;
                }
            } else {
                console.log("No transaction hash available to check status.");
                return;
            }

            if (transactionResult && transactionResult.transaction.receiver_id === NETWORK_CONFIG.contractId) {
                showCustomAlert(
                    "Your reward has been claimed. Refresh the page or check your wallet, look for $CRANS.",
                    false,
                    false,
                    false,
                    true
                );
                setGameState(GAME_STATES.CLAIMED);
            }
        } catch (error) {
            console.error("Error checking claim status:", error);
        } finally {
            localStorage.removeItem('claimInProgress');
            
            const url = new URL(window.location);
            url.searchParams.delete('transactionHashes');
            window.history.replaceState({}, '', url);
        }
    }
}

function showCustomAlert(message, isInitial = false, updateExisting = false, isEndGame = false, isClaimSuccess = false) {
    console.log("Showing custom alert:", { message, isInitial, updateExisting, isEndGame, isClaimSuccess });

    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'alert-overlay';

    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';

    const messageElement = document.createElement('p');
    messageElement.className = 'alert-message';
    messageElement.textContent = message;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'alert-button-container';

    const mainButton = document.createElement('button');
    mainButton.className = 'alert-button button';

    if (isEndGame) {
        mainButton.textContent = 'CLAIM REWARD';
        mainButton.addEventListener('click', async function() {
            document.body.removeChild(alertOverlay);
            await claimReward();
        });
    } else {
        mainButton.textContent = 'OK';
        mainButton.addEventListener('click', function() {
            document.body.removeChild(alertOverlay);
        });
    }

    buttonContainer.appendChild(mainButton);
    alertBox.appendChild(messageElement);
    alertBox.appendChild(buttonContainer);
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);

    console.log("Custom alert displayed");
}

function setupEventListeners() {
    const gameArea = document.getElementById('game-area');
    if (gameArea) {
        gameArea.addEventListener('click', function(e) {
            if (e.target === gameArea) {
                missAlienMonster();
            }
        });
    }

    setInterval(function() {
        if (gameActive && Math.random() < difficulty * 0.17) {
            const activeAlienMonster = gameArea.querySelector('.alien-monster:not([style*="opacity"])');
            if (activeAlienMonster) {
                moveAlienMonster(activeAlienMonster);
            }
        }
    }, 450);

    const connectWalletBtn = document.getElementById('connect-wallet');
    const registerCransBtn = document.getElementById('register-crans');
    const startGameBtn = document.getElementById('start-game');
    const disconnectWalletBtn = document.getElementById('disconnect-wallet');

    if (connectWalletBtn) connectWalletBtn.addEventListener('click', connectWallet);
    if (registerCransBtn) registerCransBtn.addEventListener('click', registerCRANS);
    if (startGameBtn) startGameBtn.addEventListener('click', startGame);
    if (disconnectWalletBtn) disconnectWalletBtn.addEventListener('click', disconnectWallet);
}

async function initializeGame() {
    try {
        await initContract();
        await updateGameDisplay();
        await checkClaimStatus();

        const cransRegistrationAttempt = localStorage.getItem('cransRegistrationAttempt');
        if (cransRegistrationAttempt === 'true') {
            showCustomAlert("$CRANS registration successful.");
            localStorage.removeItem('cransRegistrationAttempt');
        }
        
    } catch (error) {
        console.error('Error initializing game:', error);
        showCustomAlert('Failed to initialize the game. Please try again later.');
    } finally {
        isLoading = false;
        showLoadingScreen(false);
    }
}

let isLoading = true;

function showLoadingScreen(show) {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    if (loader && content) {
        if (show) {
            loader.style.display = 'flex';
            content.style.display = 'none';
        } else {
            loader.style.display = 'none';
            content.style.display = 'block';
            setTimeout(() => {
                content.classList.add('visible');
            }, 50);
        }
    }
}

function setupInitialUI() {
    const isSignedIn = wallet.isSignedIn();
    updateButtonVisibility(isSignedIn);
    
    // Show intro message by default, hide it if user is signed in
    const introMessage = document.getElementById('intro-message');
    if (introMessage) {
        introMessage.style.display = isSignedIn ? 'none' : 'block';
    }
    
    if (isSignedIn) {
        initializeGame();
    }
}

async function initialSetup() {
    console.log("Initial setup started");
    showLoadingScreen(true);
    try {
        await initNearConnection();
        console.log("NEAR connection initialized");
        setupEventListeners();
        console.log("Event listeners set up");
        await initializeGame();
        console.log("Game initialization completed");
    } catch (error) {
        console.error("Error during initial setup:", error);
        showCustomAlert("Failed to initialize the game. Please try again later.");
    } finally {
        showLoadingScreen(false);
    }
}

document.addEventListener('DOMContentLoaded', initialSetup);

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        checkClaimStatus();
    }
});
