let isLoading = true;
// Constants and Configuration
const NETWORK_CONFIG = {
    networkId: 'mainnet',
    nodeUrl: 'https://free.rpc.fastnear.com/',
    walletUrl: 'https://app.mynearwallet.com/',
    contractId: 'tagtheblockk.near',
    cransContractId: 'crans.tkn.near'
};

const CRANS_CONTRACT_ID = 'crans.tkn.near';

// Initialization
let near;
let wallet;
let contract;
let currentUser;
let currentPage = 0;

// Helper functions
function updateUIVisibility(isConnected) {
    const connectButton = document.getElementById('connect-wallet');
    const disconnectButton = document.getElementById('disconnect-wallet');
    const submitButton = document.getElementById('submit-message');
    const messageForm = document.getElementById('message-form');
    const messagesContainer = document.getElementById('messages-container');
    const instructions = document.getElementById('instructions');

    if (connectButton) connectButton.style.display = isConnected ? 'none' : 'block';
    if (disconnectButton) disconnectButton.style.display = isConnected ? 'block' : 'none';
    if (submitButton) submitButton.style.display = isConnected ? 'block' : 'none';
    if (messageForm) messageForm.style.display = isConnected ? 'block' : 'none';
    if (messagesContainer) messagesContainer.style.display = isConnected ? 'block' : 'none';
    if (instructions) instructions.style.display = isConnected ? 'none' : 'block';
}

async function updateDisplay() {
    const walletInfo = document.getElementById('wallet-info');
    const isSignedIn = wallet.isSignedIn();
    
    if (isSignedIn) {
        const accountId = wallet.getAccountId();
        const formattedAccountId = formatAccountId(accountId);
        let infoText = `Connected as: ${formattedAccountId}<br>`;
        
        try {
            const account = await near.account(accountId);
            const balance = await account.getAccountBalance();
            const formattedBalance = nearApi.utils.format.formatNearAmount(balance.available, 2);
            infoText += `${formattedBalance} NEAR<br>`;

            // Fetch CRANS balance
            const cransBalance = await fetchCRANSBalance(accountId);
            infoText += `${cransBalance} CRANS`;
        } catch (error) {
            console.error('Error fetching account balance:', error);
            infoText += 'Error fetching balance';
        }
        
        walletInfo.innerHTML = infoText;
        walletInfo.style.display = 'block';
        
        await displayMessages();
    } else {
        walletInfo.innerHTML = '';
        walletInfo.style.display = 'none';
    }

    updateUIVisibility(isSignedIn);
}

function formatAccountId(accountId) {
    if (accountId.length > 32) {
        return `${accountId.slice(0, 4)}...${accountId.slice(-4)}`;
    }
    return accountId;
}

async function fetchCRANSBalance(accountId) {
    try {
        const result = await wallet.account().viewFunction(
            CRANS_CONTRACT_ID,
            'ft_balance_of',
            { account_id: accountId }
        );
        return nearApi.utils.format.formatNearAmount(result, 8);
    } catch (error) {
        console.error('Error fetching CRANS balance:', error);
        return 'N/A';
    }
}

async function displayMessages() {
    if (!wallet.isSignedIn()) return;

    const messageList = document.getElementById('message-list');
    messageList.innerHTML = '<div class="loading">Loading messages...</div>';

    try {
        const messageCount = await contract.get_message_count();

        if (messageCount === 0) {
            messageList.innerHTML = '<div class="message">No messages yet. Be the first to tag the block!</div>';
            return;
        }

        // Fetch all messages
        const allMessages = await contract.get_messages({
            args: {
                from_index: 0,
                limit: messageCount
            }
        });

        console.log('Fetched messages:', allMessages);

        messageList.innerHTML = ''; // Clear the loading message

        // Reverse the order of messages before displaying
    allMessages.reverse().forEach((message) => {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const { text, author, timestamp } = message;
        const formattedAuthor = formatAccountId(author);

        const date = new Date(parseInt(timestamp) / 1000000);
        messageElement.innerHTML = `
            <span class="message-author">${escapeHTML(formattedAuthor)}</span>
            <span class="message-date">${date.toLocaleString()}</span>
            <p class="message-text">${escapeHTML(text)}</p>
        `;
        messageList.appendChild(messageElement);
    });

        // Scroll to the top of the message list
        messageList.scrollTop = 0;
    } catch (error) {
        console.error('Error displaying messages:', error);
        messageList.innerHTML = '<div class="error">Failed to load messages. Please try again.</div>';
        showCustomAlert('Failed to load messages. Please try again.');
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function showLoadingScreen() {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    if (loader && content) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
        content.style.opacity = '0';
    }
}

function hideLoadingScreen() {
    const loader = document.getElementById('loader');
    const content = document.getElementById('content');
    if (loader && content) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            content.style.opacity = '1';
            content.classList.add('visible');
        }, 500);
    }
}

async function addMessage(message) {
    if (!wallet.isSignedIn()) {
        showCustomAlert('Please connect your wallet first.');
        return;
    }

    try {
        // Prepare the deposit amount (0.1 NEAR)
        const deposit = nearApi.utils.format.parseNearAmount('0.1');

        // Show a loading message without OK button
        const loadingAlert = showCustomAlert('Submitting your tag. Please sign the transaction in your wallet.', false);

        // Call the add_message function on the contract
        const result = await contract.add_message(
            { text: message },
            300000000000000, // 300 TGas
            deposit // Attach 0.1 NEAR
        );

        console.log('Add message result:', result);
        
        // Remove the loading alert
        if (document.body.contains(loadingAlert)) {
            document.body.removeChild(loadingAlert);
        }

        // Check the transaction result
        if (result.status && result.status.SuccessValue !== undefined) {
            showCustomAlert('Tag added successfully! 0.1 NEAR has been transferred.');
            await displayMessages(); // Refresh the message list
        } else if (result.status && result.status.Failure) {
            const errorMessage = result.status.Failure.ActionError.kind.FunctionCallError.ExecutionError;
            showCustomAlert(`Failed to add tag: ${errorMessage}`);
        } else {
            showCustomAlert('Tag submission resulted in an unexpected state. Please check your wallet for transaction details.');
        }
    } catch (error) {
        console.error('Error adding message:', error);
        
        // Remove the loading alert if it's still there
        if (document.body.contains(loadingAlert)) {
            document.body.removeChild(loadingAlert);
        }

        // Handle specific error cases
        if (error.message.includes('User rejected the transaction')) {
            showCustomAlert('Transaction was cancelled. Your tag was not submitted.');
        } else {
            showCustomAlert(`An error occurred while processing your tag. Please try again. Error details: ${error.toString()}`);
        }
    }
}
async function connectWallet() {
    if (!wallet.isSignedIn()) {
        try {
            await wallet.requestSignIn({
                contractId: NETWORK_CONFIG.contractId,
                methodNames: ['add_message'],
                successUrl: window.location.origin + window.location.pathname,
                failureUrl: window.location.origin + window.location.pathname
            });
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showCustomAlert(`Failed to connect wallet. Error: ${error.toString()}`);
        }
    }
    await updateDisplay();
    await displayMessages(); 
}
async function initContract() {
    const nearConfig = {
        networkId: NETWORK_CONFIG.networkId,
        keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore(),
        nodeUrl: NETWORK_CONFIG.nodeUrl,
        walletUrl: NETWORK_CONFIG.walletUrl,
        contractName: NETWORK_CONFIG.contractId,
    };

    near = await nearApi.connect(nearConfig);
    wallet = new nearApi.WalletConnection(near, 'tag-the-block');

    contract = new nearApi.Contract(
        wallet.account(),
        NETWORK_CONFIG.contractId,
        {
            viewMethods: ['get_messages', 'get_message_count'],
            changeMethods: ['add_message'],
        }
    );
}
function disconnectWallet() {
    wallet.signOut();
    updateDisplay();
    
    // Clear the transaction hash from the URL
    const url = new URL(window.location);
    url.searchParams.delete('transactionHashes');
    window.history.replaceState({}, '', url);
}

function showCustomAlert(message, showOkButton = true) {
    const existingAlert = document.querySelector('.alert-overlay');
    if (existingAlert) {
        document.body.removeChild(existingAlert);
    }

    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'alert-overlay';

    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';

    const messageElement = document.createElement('p');
    messageElement.className = 'alert-message';
    messageElement.textContent = message;

    alertBox.appendChild(messageElement);

    if (showOkButton) {
        const okButton = document.createElement('button');
        okButton.className = 'alert-button';
        okButton.textContent = 'OK';
        okButton.addEventListener('click', function() {
            document.body.removeChild(alertOverlay);
        });
        alertBox.appendChild(okButton);
    }

    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);

    return alertOverlay;
}

async function initContract() {
    const nearConfig = {
        networkId: NETWORK_CONFIG.networkId,
        keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore(),
        nodeUrl: NETWORK_CONFIG.nodeUrl,
        walletUrl: NETWORK_CONFIG.walletUrl,
        contractName: NETWORK_CONFIG.contractId,
    };

    near = await nearApi.connect(nearConfig);
    
    wallet = new nearApi.WalletConnection(near, 'tag-the-block');

    contract = new nearApi.Contract(
        wallet.account(),
        NETWORK_CONFIG.contractId,
        {
            viewMethods: ['get_messages', 'get_message_count'],
            changeMethods: ['add_message'],
        }
    );
}

function setupEventListeners() {
    const connectWalletBtn = document.getElementById('connect-wallet');
    const disconnectWalletBtn = document.getElementById('disconnect-wallet');
    const submitMessageBtn = document.getElementById('submit-message');
    const messageInput = document.getElementById('message-input');

    if (connectWalletBtn) connectWalletBtn.addEventListener('click', connectWallet);
    if (disconnectWalletBtn) disconnectWalletBtn.addEventListener('click', disconnectWallet);
if (submitMessageBtn) {
    submitMessageBtn.addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent form submission
        if (!wallet.isSignedIn()) {
            showCustomAlert('Please connect your wallet first.');
            return;
        }
        const message = messageInput.value.trim();
        if (message) {
            submitMessageBtn.disabled = true; // Disable the button to prevent multiple submissions
            console.log('Submitting message:', message);
            await addMessage(message);
            messageInput.value = '';
            updateCharCount();
            submitMessageBtn.disabled = false; // Re-enable the button
        } else {
            showCustomAlert('Please enter a message before submitting.');
        }
    });
}
    if (messageInput) {
        messageInput.addEventListener('input', updateCharCount);
    }
}

function updateCharCount() {
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('char-count');
    const remainingChars = 300 - messageInput.value.length;
    charCount.textContent = `Characters left: ${remainingChars}`;
}

async function initializeApp() {
    showLoadingScreen();
    try {
        await initContract();
        setupEventListeners();
        
        if (wallet.isSignedIn()) {
            await updateDisplay();
            await displayMessages();
        } else {
            updateUIVisibility(false);
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showCustomAlert('Failed to initialize the app. Please try again later.');
    } finally {
        hideLoadingScreen();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    showLoadingScreen();
    setTimeout(initializeApp, 100);
});
