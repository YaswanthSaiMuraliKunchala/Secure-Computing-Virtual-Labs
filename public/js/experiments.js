/**
 * Experiments Page JavaScript
 * Handles animations and interactivity for the experiments page
 */

document.addEventListener('DOMContentLoaded', function() {
  // Handle user dropdown toggle
  const userDropdownButton = document.querySelector('.user-dropdown-button');
  const userDropdownMenu = document.querySelector('.user-dropdown-menu');
  
  if (userDropdownButton && userDropdownMenu) {
    userDropdownButton.addEventListener('click', function(e) {
      e.preventDefault();
      userDropdownMenu.style.display = userDropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!userDropdownButton.contains(e.target) && !userDropdownMenu.contains(e.target)) {
        userDropdownMenu.style.display = 'none';
      }
    });
  }
  
  // Initialize scroll reveal animations
  initScrollReveal();
  
  // Initialize experiment card hover effects
  initCardEffects();
  
  // Apply staggered animations to cards
  applyStaggeredAnimations();
  
  // Initialize tooltips if Bootstrap is available
  if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }
  
  // Dark theme support
  const toggleThemeBtn = document.getElementById('toggle-theme');
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener('click', function() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
  
  // Check stored theme preference
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
    document.documentElement.setAttribute('data-theme', storedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  
  // Initialize user dropdown menu if present
  initExperimentsUserDropdown();
});

/**
 * Initialize scroll reveal animations
 * Reveals elements as they come into view during scrolling
 */
function initScrollReveal() {
  const elements = document.querySelectorAll('.scroll-reveal');
  
  // Check elements on initial load
  checkScrollReveal();
  
  // Add scroll event listener
  window.addEventListener('scroll', checkScrollReveal);
  
  function checkScrollReveal() {
    elements.forEach(el => {
      const elementTop = el.getBoundingClientRect().top;
      const elementVisible = 150;
      if (elementTop < window.innerHeight - elementVisible) {
        el.classList.add('active');
      }
    });
  }
}

/**
 * Initialize experiment card hover effects
 * Adds interactive effects to experiment cards
 */
function initCardEffects() {
  const cards = document.querySelectorAll('.experiment-card');
  
  cards.forEach(card => {
    // Add hover effects
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-5px)';
      this.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
      
      // Add shine effect to button
      const btn = this.querySelector('.btn-primary');
      if (btn) {
        btn.style.transform = 'scale(1.05)';
      }
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = '';
      this.style.boxShadow = '';
      
      // Remove shine effect from button
      const btn = this.querySelector('.btn-primary');
      if (btn) {
        btn.style.transform = '';
      }
    });
    
    // Add click effect
    card.addEventListener('mousedown', function() {
      this.style.transform = 'translateY(-2px)';
    });
    
    card.addEventListener('mouseup', function() {
      this.style.transform = 'translateY(-5px)';
    });
  });
  
  // Add button effects
  const buttons = document.querySelectorAll('.experiment-card .btn-primary');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
    });
    
    btn.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });
}

/**
 * Apply staggered animations to experiment cards
 * Makes cards appear one after another for a dynamic loading effect
 */
function applyStaggeredAnimations() {
  const cards = document.querySelectorAll('.experiment-card');
  
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 * index);
  });
}

/**
 * Initialize user dropdown menu for experiments page
 * Ensures proper logout functionality
 */
function initExperimentsUserDropdown() {
  const userDropdownMenu = document.getElementById('expUserMenu');
  const userDropdownButton = document.getElementById('expUserButton');
  
  if (userDropdownButton && userDropdownMenu) {
    // Toggle dropdown
    userDropdownButton.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      const isVisible = userDropdownMenu.style.display === 'block';
      
      // Close menu when clicking outside
      function closeMenu(e) {
        if (!userDropdownButton.contains(e.target) && !userDropdownMenu.contains(e.target)) {
          userDropdownMenu.style.display = 'none';
          document.removeEventListener('click', closeMenu);
        }
      }
      
      if (!isVisible) {
        userDropdownMenu.style.display = 'block';
        document.addEventListener('click', closeMenu);
        
        // Apply dark theme if needed
        if (document.documentElement.getAttribute('data-theme') === 'dark') {
          userDropdownMenu.style.backgroundColor = '#2d3436';
          userDropdownMenu.style.borderColor = '#4b6584';
          
          const menuItems = userDropdownMenu.querySelectorAll('a, button');
          menuItems.forEach(item => {
            item.style.color = '#ffffff';
            if (item.tagName === 'A') {
              item.style.borderBottomColor = '#4b6584';
            }
          });
          
          const logoutBtn = userDropdownMenu.querySelector('button[type="submit"]');
          if (logoutBtn) {
            logoutBtn.style.color = '#fc5c65';
          }
        }
      } else {
        userDropdownMenu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
      }
    });
    
    // Handle hover effects
    userDropdownMenu.querySelectorAll('a, button').forEach(item => {
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
} 