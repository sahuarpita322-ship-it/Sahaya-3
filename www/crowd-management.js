// ========================================
// CROWD MANAGEMENT INFOGRAPHIC ANIMATIONS
// ========================================

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });

  // Load saved theme
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
}

// Particle Generation
function generateParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;

  const particleCount = window.innerWidth > 768 ? 50 : 20;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    const size = Math.random() * 3 + 1;
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;

    particle.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.8), rgba(6, 182, 212, 0));
      border-radius: 50%;
      left: ${x}px;
      top: ${y}px;
      box-shadow: 0 0 ${size * 2}px rgba(6, 182, 212, 0.5);
      animation: float-particle ${duration}s linear infinite;
      animation-delay: ${delay}s;
    `;

    particlesContainer.appendChild(particle);
  }

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes float-particle {
      0% {
        transform: translateY(0) translateX(0);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translateY(-100vh) translateX(${Math.random() * 200 - 100}px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Initialize particles
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', generateParticles);
} else {
  generateParticles();
}

// Smart Map Heatmap Animation
function animateHeatmap() {
  const zones = document.querySelectorAll('.zone-low, .zone-medium, .zone-high');
  
  zones.forEach((zone) => {
    const radius = Math.random() * 20 + 35;
    const startRadius = radius - 10;
    let currentRadius = startRadius;
    let direction = 1;

    setInterval(() => {
      currentRadius += direction * 0.5;
      if (currentRadius >= radius) direction = -1;
      if (currentRadius <= startRadius) direction = 1;
      
      zone.setAttribute('r', currentRadius);
    }, 30);
  });
}

// Ambulance Route Animation
function animateAmbulance() {
  const ambulance = document.getElementById('ambulance-icon');
  const route = document.getElementById('ambulance-route');
  
  if (!ambulance || !route) return;

  // Get path length
  const pathLength = route.getTotalLength();

  // Start animation
  let progress = 0;
  const interval = setInterval(() => {
    progress = (progress + 0.002) % 1;

    // Get point on path
    const point = route.getPointAtLength(progress * pathLength);
    
    // Update ambulance position
    ambulance.setAttribute('transform', `translate(${point.x - 50}, ${point.y - 50})`);

    // Show alert at high density area
    if (progress > 0.35 && progress < 0.4) {
      const alertPopup = document.getElementById('alert-popup');
      if (alertPopup) {
        alertPopup.style.opacity = '1';
      }
    } else {
      const alertPopup = document.getElementById('alert-popup');
      if (alertPopup) {
        alertPopup.style.opacity = '0';
      }
    }
  }, 50);
}

// Safe Route Highlighting
function highlightSafeRoute() {
  const safeRoute = document.getElementById('safe-route');
  if (!safeRoute) return;

  const pathLength = safeRoute.getTotalLength();
  
  // Create glow effect
  const glowStyle = document.createElement('style');
  glowStyle.textContent = `
    @keyframes route-glow {
      0%, 100% {
        filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.6));
      }
      50% {
        filter: drop-shadow(0 0 12px rgba(16, 185, 129, 1));
      }
    }
    
    #safe-route {
      animation: route-glow 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(glowStyle);
}

// Alert Pulse Effect
function initializeAlertSystem() {
  const alertPopup = document.getElementById('alert-popup');
  if (!alertPopup) return;

  // Initial state
  alertPopup.style.opacity = '0';

  // Simulate alerts
  setInterval(() => {
    const randomShow = Math.random();
    if (randomShow > 0.7) {
      alertPopup.style.opacity = '1';
      setTimeout(() => {
        alertPopup.style.opacity = '0';
      }, 3000);
    }
  }, 8000);
}

// User Location Clustering Animation
function animateUserClusters() {
  const clusters = document.querySelectorAll('circle[cx="100"][cy="200"], circle[cx="280"][cy="120"]');
  
  clusters.forEach((cluster) => {
    let pulse = 0;
    setInterval(() => {
      pulse = (pulse + 0.05) % (2 * Math.PI);
      const scale = 1 + Math.sin(pulse) * 0.2;
      cluster.style.transform = `scale(${scale})`;
    }, 30);
  });
}

// Real-time Metrics Update
function updateMetrics() {
  // Simulate live metric updates
  const metrics = [
    { value: 98.5, label: 'Route Accuracy', variation: 0.2 },
    { value: 4.2, label: 'Response Time', variation: 0.3 },
    { value: 15000, label: 'Volunteers', variation: 500 },
    { value: 99.7, label: 'Uptime', variation: 0.1 }
  ];

  setInterval(() => {
    metrics.forEach((metric, index) => {
      const randomVariation = (Math.random() - 0.5) * metric.variation * 2;
      const newValue = metric.value + randomVariation;
      // Update if needed (values update in real implementation)
    });
  }, 5000);
}

// Initialize all animations
document.addEventListener('DOMContentLoaded', () => {
  // Wait for SVG to be rendered
  setTimeout(() => {
    animateHeatmap();
    animateAmbulance();
    highlightSafeRoute();
    initializeAlertSystem();
    animateUserClusters();
    updateMetrics();
  }, 500);
});

// Scroll Animations for Feature Cards
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.animation = getComputedStyle(entry.target).animation || 'fade-in 0.6s ease-out forwards';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe elements
document.querySelectorAll('.feature-card, .feature-card-horizontal, .stat-card').forEach((el) => {
  observer.observe(el);
});

// Responsive Particle Adjustment
window.addEventListener('resize', () => {
  const particlesContainer = document.getElementById('particles');
  if (particlesContainer && window.innerWidth < 768) {
    // Reduce particles on mobile
    const particles = particlesContainer.querySelectorAll('div');
    const toRemove = Math.floor(particles.length * 0.6);
    for (let i = 0; i < toRemove; i++) {
      particles[i].remove();
    }
  }
});

// Smooth Scroll Links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// CTA Button Animation
const ctaButton = document.querySelector('button:contains("Get Started")');
if (ctaButton) {
  ctaButton.addEventListener('click', () => {
    // Ripple effect
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      transform: scale(0);
      animation: ripple-animation 0.6s ease-out;
    `;
    ctaButton.style.position = 'relative';
    ctaButton.style.overflow = 'hidden';
    ctaButton.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });
}

// Add ripple animation
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(rippleStyle);

console.log('Crowd Management System Loaded Successfully');
