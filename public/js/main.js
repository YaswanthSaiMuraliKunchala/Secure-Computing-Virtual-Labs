/**
 * Secured Computing Virtual Lab - Main JavaScript
 * Handles common functionality across the application
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check login status first
    checkLoginStatus();
    
    // Initialize theme
    initTheme();
    
    // Initialize sidebar
    initSidebar();
    
    // Initialize user dropdown
    initUserDropdown();
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize experiment layout
    initExperimentLayout();
    
    // Initialize code editor with language selection
    initCodeEditor();
    
    // Mark completed experiments
    markCompletedExperiments();
    
    // Initialize logout functionality
    initLogout();
    
    // Remove page-transition elements completely from DOM
    document.querySelectorAll('.page-transition, .lab-loader').forEach(element => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    
    // Countdown timers
    function updateCountdown(targetDate, daysId, hoursId, minutesId, secondsId) {
        const now = new Date().getTime();
        const distance = targetDate - now;
        
        if (distance < 0) {
            document.getElementById(daysId).textContent = '00';
            document.getElementById(hoursId).textContent = '00';
            document.getElementById(minutesId).textContent = '00';
            document.getElementById(secondsId).textContent = '00';
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        document.getElementById(daysId).textContent = days < 10 ? '0' + days : days;
        document.getElementById(hoursId).textContent = hours < 10 ? '0' + hours : hours;
        document.getElementById(minutesId).textContent = minutes < 10 ? '0' + minutes : minutes;
        document.getElementById(secondsId).textContent = seconds < 10 ? '0' + seconds : seconds;
    }
    
    // Set the date for mid sem (March 20, 2025)
    const midSemDate = new Date('Mar 20, 2025 09:00:00').getTime();
    // Set the date for end sem (May 15, 2025)
    const endSemDate = new Date('May 15, 2025 09:00:00').getTime();
    
    if (document.getElementById('days')) {
        // Update the countdown every 1 second
        setInterval(function() {
            updateCountdown(midSemDate, 'days', 'hours', 'minutes', 'seconds');
            updateCountdown(endSemDate, 'end-days', 'end-hours', 'end-minutes', 'end-seconds');
        }, 1000);
    }
    
    // Load completed experiments
    function loadCompletedExperiments() {
        const completedExperiments = JSON.parse(localStorage.getItem('completedExperiments')) || [];
        const totalExperiments = 14;
        
        // Update progress display
        const completedCount = document.getElementById('completed-count');
        const progressText = document.getElementById('progress-text');
        const progressCircle = document.getElementById('progress-circle');
        
        if (completedCount) completedCount.textContent = completedExperiments.length;
        if (progressText) progressText.textContent = `${completedExperiments.length}/${totalExperiments}`;
        
        // Calculate and update the progress circle
        if (progressCircle) {
            const circumference = 2 * Math.PI * 16; // r = 16
            const offset = circumference - (completedExperiments.length / totalExperiments) * circumference;
            progressCircle.style.strokeDasharray = `${circumference}`;
            progressCircle.style.strokeDashoffset = `${offset}`;
        }
        
        // Mark completed experiments in sidebar
        completedExperiments.forEach(id => {
            const checkmark = document.getElementById(`check-${id}`);
            if (checkmark) {
                checkmark.style.display = 'block';
            }
            
            // Also mark in the sidebar menu
            const sidebarItem = document.querySelector(`.sidebar-menu-link[href="/experiments/${id}"]`);
            if (sidebarItem) {
                const checkIcon = sidebarItem.querySelector('.sidebar-menu-check');
                if (checkIcon) {
                    checkIcon.style.display = 'block';
                } else {
                    const newCheckIcon = document.createElement('i');
                    newCheckIcon.className = 'fas fa-check-circle sidebar-menu-check';
                    sidebarItem.appendChild(newCheckIcon);
                }
            }
        });
        
        // Mark completed experiments in experiment list
        document.querySelectorAll('.experiment').forEach(experiment => {
            const id = experiment.getAttribute('data-id');
            if (completedExperiments.includes(id)) {
                experiment.classList.add('completed');
                const completedBadge = document.createElement('div');
                completedBadge.className = 'completed-badge';
                completedBadge.innerHTML = '<i class="fas fa-check-circle"></i>';
                experiment.appendChild(completedBadge);
            }
        });
        
        return completedExperiments.length;
    }
    
    // Show notification
    window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification ' + type;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            </div>
            <div class="notification-content">
                ${message}
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto hide after 5 seconds
        const hideTimeout = setTimeout(() => {
            hideNotification(notification);
        }, 5000);
        
        // Close button
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            clearTimeout(hideTimeout);
            hideNotification(notification);
        });
        
        function hideNotification(element) {
            element.classList.remove('show');
            setTimeout(() => {
                element.remove();
            }, 300);
        }
    };
    
    // Initialize DataTables if available
    if (typeof $.fn.DataTable !== 'undefined') {
        $('table.dataTable').DataTable({
            responsive: true,
            language: {
                search: "_INPUT_",
                searchPlaceholder: "Search...",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                infoEmpty: "Showing 0 to 0 of 0 entries",
                infoFiltered: "(filtered from _MAX_ total entries)"
            }
        });
    }
    
    // Form validation
    const forms = document.querySelectorAll('.needs-validation');
    
    if (forms.length > 0) {
        Array.from(forms).forEach(form => {
            form.addEventListener('submit', event => {
                if (!form.checkValidity()) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                
                form.classList.add('was-validated');
            }, false);
        });
    }
});

/**
 * Theme Management
 */
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const storedTheme = localStorage.getItem('theme') || 'light';
    
    // Set initial theme
    document.documentElement.setAttribute('data-theme', storedTheme);
    updateThemeIcon(storedTheme === 'dark');
    
    // Theme toggle click handler
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            updateThemeIcon(newTheme === 'dark');
        });
    }
}

function updateThemeIcon(isDark) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            if (isDark) {
                icon.className = 'fas fa-sun';
            } else {
                icon.className = 'fas fa-moon';
            }
        }
    }
}

/**
 * Sidebar Management
 */
function initSidebar() {
    const toggleSidebar = document.getElementById('toggle-sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    // Toggle sidebar
    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
            document.body.classList.toggle('sidebar-open');
        });
    }
    
    // Close sidebar
    if (closeSidebar && sidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
            document.body.classList.remove('sidebar-open');
        });
    }
    
    // Close sidebar when clicking on overlay
    if (sidebarOverlay && sidebar) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
    }
    
    // Close sidebar when clicking on a menu item (mobile)
    const sidebarMenuLinks = document.querySelectorAll('.sidebar-menu-link');
    if (sidebarMenuLinks.length > 0 && sidebar) {
        sidebarMenuLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 992) {
                    sidebar.classList.remove('active');
                    if (sidebarOverlay) {
                        sidebarOverlay.classList.remove('active');
                    }
                    document.body.classList.remove('sidebar-open');
                }
            });
        });
    }
    
    // Highlight current page in sidebar
    const currentPath = window.location.pathname;
    const currentLink = document.querySelector(`.sidebar-menu-link[href="${currentPath}"]`);
    if (currentLink) {
        currentLink.classList.add('active');
    }
}

/**
 * User Dropdown Management
 */
function initUserDropdown() {
    // Generic dropdown toggle function
    function toggleDropdown(event, dropdownId) {
        event.preventDefault();
        event.stopPropagation();
        
        const menu = document.getElementById(dropdownId);
        if (!menu) return;
        
        const isVisible = menu.style.display === 'block';
        
        // Close all other dropdowns first
        document.querySelectorAll('.dropdown-menu, .user-menu, #userDropdownMenu').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
        
        if (!isVisible) {
            // Show this dropdown
            menu.style.display = 'block';
            
            // Close dropdown when clicking outside
            function closeMenu(e) {
                if (!e.target.closest('.nav-item.dropdown, .user-profile, .user-dropdown')) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', closeMenu);
                }
            }
            
            document.addEventListener('click', closeMenu);
            
            // Apply dark theme if needed
            if (document.documentElement.getAttribute('data-theme') === 'dark') {
                menu.style.backgroundColor = '#2d3436';
                menu.style.borderColor = '#4b6584';
                const menuItems = menu.querySelectorAll('a, button');
                menuItems.forEach(item => {
                    item.style.color = '#ffffff';
                    if (item.tagName === 'A') {
                        item.style.borderBottomColor = '#4b6584';
                    }
                });
                const logoutBtn = menu.querySelector('button[type="submit"]');
                if (logoutBtn) {
                    logoutBtn.style.color = '#fc5c65';
                }
            }
        }
    }
    
    // Initialize the main header dropdown
    const userMenuToggle = document.querySelector('.nav-item.dropdown button');
    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', (e) => toggleDropdown(e, 'userDropdownMenu'));
    }
    
    // Initialize the profile button in settings page
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => toggleDropdown(e, 'profile-dropdown'));
    }
    
    // Initialize any other user menu toggle buttons with data attribute
    document.querySelectorAll('[data-dropdown-toggle]').forEach(toggle => {
        const targetId = toggle.getAttribute('data-dropdown-toggle');
        toggle.addEventListener('click', (e) => toggleDropdown(e, targetId));
    });
    
    // Add hover effects to all user menu items
    document.querySelectorAll('.dropdown-menu a, .dropdown-menu button, .user-menu a, .user-menu button, #userDropdownMenu a, #userDropdownMenu button').forEach(item => {
        item.addEventListener('mouseover', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            item.style.backgroundColor = isDark ? '#4b6584' : '#f8f9fa';
        });
        
        item.addEventListener('mouseout', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            item.style.backgroundColor = isDark ? '#2d3436' : 'white';
        });
    });
}

/**
 * Initialize Bootstrap Tooltips
 */
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Mark completed experiments in sidebar
 */
function markCompletedExperiments() {
    const completedCount = loadCompletedExperiments();
    updateProgress(completedCount);
    
    // Highlight current experiment in sidebar
    const currentPath = window.location.pathname;
    const currentExperiment = document.querySelector(`.sidebar-menu-link[href="${currentPath}"]`);
    
    if (currentExperiment) {
        currentExperiment.classList.add('active');
        
        // Scroll to the current experiment in sidebar
        const sidebarContent = document.querySelector('.sidebar-content');
        if (sidebarContent) {
            const experimentOffset = currentExperiment.offsetTop;
            sidebarContent.scrollTop = experimentOffset - 100;
        }
    }
}

/**
 * Update progress display
 */
function updateProgress(completedCount) {
    const totalExperiments = 14;
    const progressPercentage = (completedCount / totalExperiments) * 100;
    
    // Update progress in navbar if exists
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.setAttribute('aria-valuenow', progressPercentage);
    }
    
    // Update progress text if exists
    const progressText = document.querySelector('.progress-text');
    if (progressText) {
        progressText.textContent = `${completedCount}/${totalExperiments} (${Math.round(progressPercentage)}%)`;
    }
}

/**
 * Initialize experiment layout
 */
function initExperimentLayout() {
    // Visualize button
    const visualizeBtn = document.getElementById('visualize-btn');
    const visualizationSection = document.getElementById('visualization-section');
    
    if (visualizeBtn && visualizationSection) {
        visualizeBtn.addEventListener('click', () => {
            visualizationSection.classList.remove('d-none');
            
            // Get experiment type
            const experimentType = document.body.getAttribute('data-experiment-type');
            
            // Get input values
            const inputText = document.getElementById('input-text').value;
            
            // Visualize based on experiment type
            if (experimentType === 'caesar-cipher') {
                const shiftValue = parseInt(document.getElementById('shift-value').value);
                visualizeCaesarCipher(inputText, shiftValue);
            } else if (experimentType === 'mono-alphabetic-cipher') {
                const key = document.getElementById('key-value') ? document.getElementById('key-value').value : 'QWERTYUIOPASDFGHJKLZXCVBNM';
                visualizeMonoalphabeticCipher(inputText, key);
            } else {
                showNotification('Visualization for this experiment type is not implemented yet.', 'info');
            }
        });
    }
}

/**
 * Initialize code editor
 */
function initCodeEditor() {
    const codeEditor = document.getElementById('code-editor');
    const languageSelector = document.getElementById('language-selector');
    const clearCodeBtn = document.getElementById('clear-code-btn');
    
    if (codeEditor) {
        // Add line numbers
        const lineNumbersContainer = document.createElement('div');
        lineNumbersContainer.className = 'line-numbers';
        codeEditor.parentNode.insertBefore(lineNumbersContainer, codeEditor);
        codeEditor.classList.add('with-line-numbers');
        
        // Update line numbers on input
        codeEditor.addEventListener('input', updateLineNumbers);
        codeEditor.addEventListener('scroll', () => {
            lineNumbersContainer.scrollTop = codeEditor.scrollTop;
        });
        
        // Initial line numbers
        updateLineNumbers();
        
        // Clear code button
        if (clearCodeBtn) {
            clearCodeBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all code? This cannot be undone.')) {
                    codeEditor.value = '';
                    updateLineNumbers();
                }
            });
        }
        
        // Language selector
        if (languageSelector) {
            languageSelector.addEventListener('change', () => {
                const language = languageSelector.value;
                const experimentType = document.body.getAttribute('data-experiment-type');
                
                // Get starter code for selected language
                fetch(`/api/starter-code/${experimentType}/${language}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.code) {
                            if (confirm('Changing language will replace your current code. Continue?')) {
                                codeEditor.value = data.code;
                                updateLineNumbers();
                            } else {
                                // Reset selector to previous value
                                languageSelector.value = codeEditor.getAttribute('data-language');
                            }
                        } else {
                            showNotification('Failed to load starter code for selected language.', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error loading starter code:', error);
                        showNotification('Failed to load starter code for selected language.', 'error');
                    });
            });
        }
    }
    
    function updateLineNumbers() {
        const lineNumbersContainer = document.querySelector('.line-numbers');
        if (!lineNumbersContainer || !codeEditor) return;
        
        const lines = codeEditor.value.split('\n');
        const lineCount = lines.length;
        
        let lineNumbersHTML = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHTML += `<div>${i}</div>`;
        }
        
        lineNumbersContainer.innerHTML = lineNumbersHTML;
        lineNumbersContainer.style.height = `${codeEditor.scrollHeight}px`;
    }
}

/**
 * Visualize Caesar Cipher
 */
function visualizeCaesarCipher(text, shift) {
    const visualizationTable = document.getElementById('visualization-table');
    const outputText = document.getElementById('output-text');
    
    if (!visualizationTable || !outputText) return;
    
    let tableHTML = `
        <thead>
            <tr>
                <th>Character</th>
                <th>ASCII Value</th>
                <th>Shift</th>
                <th>New ASCII</th>
                <th>New Character</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    let encryptedText = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isAlpha = /[a-zA-Z]/.test(char);
        
        if (isAlpha) {
            const isUpper = char === char.toUpperCase();
            const asciiOffset = isUpper ? 65 : 97;
            const asciiValue = char.charCodeAt(0);
            const position = asciiValue - asciiOffset;
            const newPosition = (position + shift) % 26;
            const newAscii = newPosition + asciiOffset;
            const newChar = String.fromCharCode(newAscii);
            
            encryptedText += newChar;
            
            tableHTML += `
                <tr>
                    <td>${char}</td>
                    <td>${asciiValue}</td>
                    <td>+${shift}</td>
                    <td>${newAscii}</td>
                    <td>${newChar}</td>
                </tr>
            `;
        } else {
            encryptedText += char;
            
            tableHTML += `
                <tr>
                    <td>${char}</td>
                    <td colspan="3">Not a letter (unchanged)</td>
                    <td>${char}</td>
                </tr>
            `;
        }
    }
    
    tableHTML += '</tbody>';
    visualizationTable.innerHTML = tableHTML;
    outputText.textContent = encryptedText;
}

/**
 * Visualize Monoalphabetic Cipher
 */
function visualizeMonoalphabeticCipher(text, key) {
    const visualizationTable = document.getElementById('visualization-table');
    const outputText = document.getElementById('output-text');
    
    if (!visualizationTable || !outputText) return;
    
    // Create mapping from standard alphabet to key
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const mapping = {};
    
    for (let i = 0; i < alphabet.length; i++) {
        mapping[alphabet[i]] = key[i];
        mapping[alphabet[i].toLowerCase()] = key[i].toLowerCase();
    }
    
    let tableHTML = `
        <thead>
            <tr>
                <th>Character</th>
                <th>Original</th>
                <th>Substitution</th>
                <th>New Character</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    let encryptedText = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isAlpha = /[a-zA-Z]/.test(char);
        
        if (isAlpha) {
            const newChar = mapping[char];
            encryptedText += newChar;
            
            tableHTML += `
                <tr>
                    <td>${char}</td>
                    <td>${char.toUpperCase()}</td>
                    <td>${mapping[char.toUpperCase()]}</td>
                    <td>${newChar}</td>
                </tr>
            `;
        } else {
            encryptedText += char;
            
            tableHTML += `
                <tr>
                    <td>${char}</td>
                    <td colspan="2">Not a letter (unchanged)</td>
                    <td>${char}</td>
                </tr>
            `;
        }
    }
    
    tableHTML += '</tbody>';
    visualizationTable.innerHTML = tableHTML;
    outputText.textContent = encryptedText;
}

/**
 * Logout Handler
 * Ensures all logout buttons use POST method and properly destroy session
 */
function initLogout() {
    const logoutForms = document.querySelectorAll('form[action="/auth/logout"]');
    
    logoutForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            })
            .then(response => {
                if (response.ok) {
                    // Show success notification
                    showNotification('Logged out successfully', 'success');
                    
                    // Redirect to login page after a short delay
                    setTimeout(() => {
                        window.location.href = '/auth/login';
                    }, 1000);
                } else {
                    showNotification('Logout failed. Please try again.', 'error');
                }
            })
            .catch(error => {
                console.error('Logout error:', error);
                showNotification('An error occurred during logout.', 'error');
            });
        });
    });
}

/**
 * Check Login Status
 * Ensures the UI correctly reflects the user's login state
 */
function checkLoginStatus() {
    const hasSession = document.cookie.includes('connect.sid');
    
    // Hide or show login/register buttons based on session
    if (hasSession) {
        // Hide login/register links in all places
        document.querySelectorAll('a[href="/auth/login"], a[href="/auth/register"]').forEach(link => {
            // Don't hide if within user dropdown
            if (!link.closest('#userDropdownMenu') && 
                !link.closest('.user-dropdown-menu') && 
                !link.closest('#expUserMenu')) {
                link.style.display = 'none';
            }
        });
        
        // Show user menu wrappers if available
        const userMenuWrappers = document.querySelectorAll(
            '.nav-item.dropdown, #expUserMenu, .user-dropdown, .user-profile-wrapper'
        );
        userMenuWrappers.forEach(wrapper => {
            if (wrapper) {
                wrapper.style.display = '';
            }
        });
        
        // Show mobile/responsive menus if available
        const mobileUserMenus = document.querySelectorAll(
            '.mobile-user-menu, .responsive-user-dropdown'
        );
        mobileUserMenus.forEach(menu => {
            if (menu) {
                menu.style.display = '';
            }
        });
    } else {
        // Show login/register buttons
        document.querySelectorAll('a[href="/auth/login"], a[href="/auth/register"]').forEach(link => {
            link.style.display = '';
        });
        
        // Hide user menu wrappers
        const userMenuWrappers = document.querySelectorAll(
            '.nav-item.dropdown, #expUserMenu, .user-dropdown, .user-profile-wrapper'
        );
        userMenuWrappers.forEach(wrapper => {
            if (wrapper) {
                wrapper.style.display = 'none';
            }
        });
        
        // Hide mobile/responsive menus
        const mobileUserMenus = document.querySelectorAll(
            '.mobile-user-menu, .responsive-user-dropdown'
        );
        mobileUserMenus.forEach(menu => {
            if (menu) {
                menu.style.display = 'none';
            }
        });
        
        // Make sure dropdowns are hidden
        const dropdowns = document.querySelectorAll(
            '#userDropdownMenu, .user-dropdown-menu, #expUserDropdown, .profile-dropdown'
        );
        dropdowns.forEach(dropdown => {
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    }
} 