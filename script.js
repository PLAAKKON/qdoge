// QDOGE Scientific Paper - Minimal JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
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

    // Add section numbers dynamically
    const sections = document.querySelectorAll('.paper-section h2');
    // Already numbered in HTML

    // Copy contract address on click
    const contractAddress = document.querySelector('.contract-address');
    if (contractAddress && contractAddress.textContent !== 'TBA - Coming Soon') {
        contractAddress.style.cursor = 'pointer';
        contractAddress.title = 'Click to copy';
        
        contractAddress.addEventListener('click', function() {
            navigator.clipboard.writeText(this.textContent.trim()).then(() => {
                const original = this.textContent;
                this.textContent = '✓ Copied to clipboard';
                setTimeout(() => {
                    this.textContent = original;
                }, 2000);
            });
        });
    }

    // Add reading progress indicator
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 2px;
        background: #000;
        z-index: 1000;
        transition: width 0.1s;
    `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', function() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        progressBar.style.width = progress + '%';
    });

    // Highlight current section in nav
    const navLinks = document.querySelectorAll('.nav-links a');
    const observerOptions = {
        rootMargin: '-20% 0px -60% 0px'
    };

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.style.fontWeight = link.getAttribute('href') === '#' + id ? '700' : '400';
                });
            }
        });
    }, observerOptions);

    document.querySelectorAll('.paper-section[id]').forEach(section => {
        observer.observe(section);
    });

    console.log('QDOGE Scientific Paper loaded');
    console.log('Research Initiative © 2026');
});
