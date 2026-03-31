// QDOGE Landing Page Scripts

// Copy contract address to clipboard
function copyContract() {
    const contractAddress = document.getElementById('contract').textContent;
    navigator.clipboard.writeText(contractAddress).then(() => {
        // Show feedback
        const btn = document.querySelector('.copy-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.style.color = '#00f5a0';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll <= 0) {
        navbar.style.boxShadow = 'none';
    } else {
        navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
    }
    
    lastScroll = currentScroll;
});

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.about-card, .step-card, .social-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Add animation class styles
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

// Mobile menu toggle (for future use)
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('mobile-open');
}

// Particle effect on hero (optional enhancement)
function createParticle() {
    const hero = document.querySelector('.hero-visual');
    if (!hero) return;
    
    const particle = document.createElement('div');
    particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: linear-gradient(135deg, #00f5a0, #00d9f5);
        border-radius: 50%;
        pointer-events: none;
        animation: particleFloat 3s ease-out forwards;
    `;
    
    const rect = hero.getBoundingClientRect();
    particle.style.left = Math.random() * rect.width + 'px';
    particle.style.top = Math.random() * rect.height + 'px';
    
    hero.appendChild(particle);
    
    setTimeout(() => particle.remove(), 3000);
}

// Particle animation keyframes
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes particleFloat {
        0% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        100% {
            opacity: 0;
            transform: translateY(-100px) scale(0);
        }
    }
`;
document.head.appendChild(particleStyle);

// Create particles periodically
setInterval(createParticle, 500);

// Console easter egg
console.log(`
%c🐕 QDOGE - The Quantum Doge %c

Welcome to the quantum realm of memes!
Built on Solana. Powered by community.

🚀 To the moon!
`, 
'font-size: 20px; color: #00f5a0; font-weight: bold;',
'font-size: 12px; color: #a0a0b0;'
);

// Price ticker animation (demo - replace with real API)
function updatePriceDisplay() {
    const priceElement = document.querySelector('.stat-value');
    if (!priceElement) return;
    
    // Demo fluctuation
    const basePrice = 0.000001;
    const fluctuation = (Math.random() - 0.5) * 0.0000001;
    const newPrice = basePrice + fluctuation;
    
    // Only update if we want live prices
    // priceElement.textContent = '$' + newPrice.toFixed(7);
}

// Update price every 5 seconds (disabled by default)
// setInterval(updatePriceDisplay, 5000);
