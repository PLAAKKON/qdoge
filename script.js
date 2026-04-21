// Quantum Doge - Interactive Script

document.addEventListener('DOMContentLoaded', function() {
    // Comic Reader Configuration
    const totalPages = 14;
    let currentPage = 1;
    
    const comicPage = document.getElementById('comicPage');
    const pageLoading = document.getElementById('pageLoading');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const pageSlider = document.getElementById('pageSlider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const thumbnailStrip = document.getElementById('thumbnailStrip');
    
    // Initialize
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (pageSlider) {
        pageSlider.max = totalPages;
        pageSlider.value = 1;
    }
    
    // Generate thumbnails
    if (thumbnailStrip) {
        for (let i = 1; i <= totalPages; i++) {
            const thumb = document.createElement('div');
            thumb.className = 'thumbnail' + (i === 1 ? ' active' : '');
            thumb.innerHTML = `<img src="cartoon/PAGE${i}.jfif" alt="Page ${i}" loading="lazy">`;
            thumb.onclick = () => goToPage(i);
            thumbnailStrip.appendChild(thumb);
        }
    }
    
    // Update navigation buttons state
    function updateNavButtons() {
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }
    
    // Zoom state - 0: normal, 1: medium, 2: full width
    let zoomLevel = 0;
    
    // Go to specific page
    window.goToPage = function(pageNum) {
        pageNum = parseInt(pageNum);
        if (pageNum < 1 || pageNum > totalPages) return;
        
        currentPage = pageNum;
        
        // Reset scroll position but keep zoom level
        const container = document.querySelector('.comic-page-container');
        if (container) {
            container.scrollTop = 0;
            if (zoomLevel === 2) {
                container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
            } else {
                container.scrollLeft = 0;
            }
        }
        
        // Show loading
        if (pageLoading) pageLoading.style.display = 'block';
        if (comicPage) comicPage.style.opacity = '0.5';
        
        // Load new page
        const newSrc = `cartoon/PAGE${pageNum}.jfif`;
        if (comicPage) {
            comicPage.onload = function() {
                if (pageLoading) pageLoading.style.display = 'none';
                comicPage.style.opacity = '1';
            };
            comicPage.src = newSrc;
        }
        
        // Update UI
        if (currentPageEl) currentPageEl.textContent = pageNum;
        if (pageSlider) pageSlider.value = pageNum;
        
        // Update thumbnails
        document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
            thumb.classList.toggle('active', index + 1 === pageNum);
        });
        
        // Scroll active thumbnail into view (only within the strip, not the page)
        const activeThumbnail = document.querySelector('.thumbnail.active');
        if (activeThumbnail && thumbnailStrip) {
            const thumbLeft = activeThumbnail.offsetLeft;
            const thumbWidth = activeThumbnail.offsetWidth;
            const stripWidth = thumbnailStrip.clientWidth;
            const scrollLeft = thumbLeft - (stripWidth / 2) + (thumbWidth / 2);
            thumbnailStrip.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
        
        updateNavButtons();
    };
    
    // Mobile nav arrow auto-hide
    let navHideTimer = null;
    function showNavArrowsMobile() {
        if (window.matchMedia('(hover: none)').matches) {
            if (prevBtn) prevBtn.classList.add('mobile-visible');
            if (nextBtn) nextBtn.classList.add('mobile-visible');
            clearTimeout(navHideTimer);
            navHideTimer = setTimeout(function() {
                if (prevBtn) prevBtn.classList.remove('mobile-visible');
                if (nextBtn) nextBtn.classList.remove('mobile-visible');
            }, 2000);
        }
    }

    // Navigation functions
    window.prevPage = function() {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
        showNavArrowsMobile();
    };
    
    window.nextPage = function() {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
        showNavArrowsMobile();
    };
    
    // Zoom toggle - cycles through 3 levels
    window.toggleZoom = function() {
        const container = document.querySelector('.comic-page-container');
        const zoomBtn = document.querySelector('.zoom-btn');
        
        if (container) {
            // Cycle: 0 -> 1 -> 2 -> 0
            zoomLevel = (zoomLevel + 1) % 3;
            
            // Remove all zoom classes
            container.classList.remove('zoom-1', 'zoom-2');
            if (zoomBtn) zoomBtn.classList.remove('active', 'active-2');
            
            // Apply new zoom level
            if (zoomLevel === 1) {
                container.classList.add('zoom-1');
                if (zoomBtn) zoomBtn.classList.add('active');
            } else if (zoomLevel === 2) {
                container.classList.add('zoom-2');
                if (zoomBtn) zoomBtn.classList.add('active-2');
            }
            
            // Reset scroll position when zooming
            if (zoomLevel > 0) {
                setTimeout(() => {
                    container.scrollTop = 0;
                    // Only center scroll for zoom-2 (full width)
                    if (zoomLevel === 2) {
                        container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
                    } else {
                        container.scrollLeft = 0;
                    }
                }, 50);
            }
        }
    };
    
    // Fullscreen hover detection
    function handleFullscreenMouseMove(e) {
        const reader = document.querySelector('.comic-reader');
        if (!reader || !reader.classList.contains('fullscreen')) return;
        
        const controls = reader.querySelector('.comic-controls');
        const thumbs = reader.querySelector('.thumbnail-strip');
        const navPrev = reader.querySelector('.nav-prev');
        const navNext = reader.querySelector('.nav-next');
        
        // Check if mouse is over controls or thumbnails
        const isOverControls = controls && controls.matches(':hover');
        const isOverThumbs = thumbs && thumbs.matches(':hover');
        
        // Bottom zone - show controls (or keep visible if hovering over them)
        if (e.clientY > window.innerHeight - 180 || isOverControls || isOverThumbs) {
            if (controls) controls.classList.add('visible');
            if (thumbs) thumbs.classList.add('visible');
        } else {
            if (controls) controls.classList.remove('visible');
            if (thumbs) thumbs.classList.remove('visible');
        }
        
        // Left edge - show prev button
        if (e.clientX < 100) {
            if (navPrev) navPrev.classList.add('visible');
        } else {
            if (navPrev) navPrev.classList.remove('visible');
        }
        
        // Right edge - show next button
        if (e.clientX > window.innerWidth - 100) {
            if (navNext) navNext.classList.add('visible');
        } else {
            if (navNext) navNext.classList.remove('visible');
        }
    }
    
    // Hide all on mouse leave
    function handleFullscreenMouseLeave() {
        const reader = document.querySelector('.comic-reader');
        if (!reader || !reader.classList.contains('fullscreen')) return;
        
        const controls = reader.querySelector('.comic-controls');
        const thumbs = reader.querySelector('.thumbnail-strip');
        const navPrev = reader.querySelector('.nav-prev');
        const navNext = reader.querySelector('.nav-next');
        
        if (controls) controls.classList.remove('visible');
        if (thumbs) thumbs.classList.remove('visible');
        if (navPrev) navPrev.classList.remove('visible');
        if (navNext) navNext.classList.remove('visible');
    }
    
    document.addEventListener('mousemove', handleFullscreenMouseMove);
    document.addEventListener('mouseleave', handleFullscreenMouseLeave);
    
    // Add mouseleave to controls themselves
    const comicControls = document.querySelector('.comic-controls');
    const thumbnailStripEl = document.querySelector('.thumbnail-strip');
    
    if (comicControls) {
        comicControls.addEventListener('mouseleave', function(e) {
            const reader = document.querySelector('.comic-reader');
            if (!reader || !reader.classList.contains('fullscreen')) return;
            
            // Only hide if mouse moved above the control area
            if (e.clientY < window.innerHeight - 180) {
                comicControls.classList.remove('visible');
                if (thumbnailStripEl) thumbnailStripEl.classList.remove('visible');
            }
        });
    }
    
    if (thumbnailStripEl) {
        thumbnailStripEl.addEventListener('mouseleave', function(e) {
            const reader = document.querySelector('.comic-reader');
            if (!reader || !reader.classList.contains('fullscreen')) return;
            
            // Check if moving to controls (below) or away (above)
            if (e.clientY < window.innerHeight - 180) {
                thumbnailStripEl.classList.remove('visible');
                if (comicControls) comicControls.classList.remove('visible');
            }
        });
    }
    
    // Fullscreen toggle
    window.toggleFullscreen = function() {
        const reader = document.querySelector('.comic-reader');
        if (reader) {
            reader.classList.toggle('fullscreen');
            document.body.classList.toggle('comic-fullscreen');
            
            if (reader.classList.contains('fullscreen')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
                // Reset zoom when exiting fullscreen
                if (zoomLevel > 0) {
                    const container = document.querySelector('.comic-page-container');
                    const zoomBtn = document.querySelector('.zoom-btn');
                    if (container) container.classList.remove('zoom-1', 'zoom-2');
                    if (zoomBtn) zoomBtn.classList.remove('active', 'active-2');
                    zoomLevel = 0;
                }
                // Scroll to comic section
                const comicSection = document.querySelector('.comic-section');
                if (comicSection) {
                    comicSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
    };
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
            prevPage();
        } else if (e.key === 'ArrowRight') {
            nextPage();
        } else if (e.key === 'z' || e.key === 'Z') {
            toggleZoom();
        } else if (e.key === 'Escape') {
            const reader = document.querySelector('.comic-reader');
            if (reader && reader.classList.contains('fullscreen')) {
                toggleFullscreen();
            }
        }
    });
    
    // Touch/swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    const comicContainer = document.querySelector('.comic-page-container');
    if (comicContainer) {
        comicContainer.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        comicContainer.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        
    }
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextPage(); // Swipe left = next page
            } else {
                prevPage(); // Swipe right = previous page
            }
        }
    }
    
    // Initialize navigation state
    updateNavButtons();
    
    // Copy contract address function
    window.copyAddress = function() {
        const addressEl = document.getElementById('contractAddress');
        const copyBtn = document.querySelector('.copy-btn');
        
        if (addressEl) {
            navigator.clipboard.writeText(addressEl.textContent.trim()).then(() => {
                if (copyBtn) {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✓ Copied!';
                    copyBtn.style.background = '#10b981';
                    
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '';
                    }, 2000);
                }
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = addressEl.textContent.trim();
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (copyBtn) {
                    copyBtn.textContent = '✓ Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = '📋 Copy';
                    }, 2000);
                }
            });
        }
    };
    
    // Create floating particles
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        const symbols = ['φ', 'π', '∞', 'Σ', '√', '∫', 'Δ', 'λ', 'θ', '∂', '🐕', '✨', '🔬', '🌿'];
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('span');
            particle.className = 'particle';
            particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (15 + Math.random() * 10) + 's';
            particle.style.fontSize = (16 + Math.random() * 16) + 'px';
            particlesContainer.appendChild(particle);
        }
    }
    
    createParticles();
    
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
    
    // Add reading progress indicator
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, #6366f1, #ec4899);
        z-index: 1000;
        transition: width 0.1s;
        width: 0%;
    `;
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progressBar.style.width = progress + '%';
    });
    
    console.log('🐕✨ Quantum Doge loaded!');
    console.log('Discovering nature\'s math, one dog at a time.');
});
